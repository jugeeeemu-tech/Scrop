use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::routing::{get, post};
use axum::Router;
use http_body_util::BodyExt;
use tower::ServiceExt;

use scrop_capture::AppState;

// Re-import the route handlers - we build the same router as main.rs
// Note: routes module is private to scrop-server binary, so we use
// the public API types directly and build a test router.

mod helpers {
    use super::*;

    pub fn build_test_app() -> Router {
        let state = Arc::new(AppState::new());

        // We need to import the route handlers.
        // Since they're in the binary crate, we replicate the router
        // using the scrop_capture types directly.
        let api_routes = Router::new()
            .route("/capture/start", post(scrop_server_routes::start_capture))
            .route("/capture/stop", post(scrop_server_routes::stop_capture))
            .route(
                "/capture/status",
                get(scrop_server_routes::get_capture_status),
            )
            .route("/capture/reset", post(scrop_server_routes::reset_capture))
            .route("/interfaces", get(scrop_server_routes::list_interfaces))
            .route(
                "/interfaces/{name}/attach",
                post(scrop_server_routes::attach_interface),
            )
            .route(
                "/interfaces/{name}/detach",
                post(scrop_server_routes::detach_interface),
            );

        #[cfg(not(feature = "ebpf"))]
        let api_routes = api_routes.route(
            "/mock/config",
            get(scrop_server_routes::get_mock_config).put(scrop_server_routes::update_mock_config),
        );

        Router::new().nest("/api", api_routes).with_state(state)
    }
}

// Since route handlers are private to the binary crate, we directly test
// the API by constructing handlers inline using scrop_capture.

mod scrop_server_routes {
    use std::sync::Arc;

    use axum::extract::{Path, State};
    use axum::http::StatusCode;
    use axum::response::{IntoResponse, Json, Response};
    use serde::Serialize;

    #[cfg(not(feature = "ebpf"))]
    use scrop_capture::mock::MockTrafficProfile;
    use scrop_capture::types::CaptureStats;
    use scrop_capture::{AppState, CaptureError};

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct CaptureStatusResponse {
        pub is_capturing: bool,
        pub stats: CaptureStats,
        pub mode: String,
    }

    #[derive(Serialize)]
    pub struct MessageResponse {
        pub message: String,
    }

    pub struct ApiError {
        status: StatusCode,
        error: String,
    }

    #[derive(Serialize)]
    struct ApiErrorBody {
        error: String,
    }

    impl IntoResponse for ApiError {
        fn into_response(self) -> Response {
            (self.status, Json(ApiErrorBody { error: self.error })).into_response()
        }
    }

    impl From<CaptureError> for ApiError {
        fn from(err: CaptureError) -> Self {
            let status = match &err {
                CaptureError::InterfaceNotFound(_) | CaptureError::InvalidState(_) => {
                    StatusCode::BAD_REQUEST
                }
                CaptureError::PermissionDenied(_) => StatusCode::FORBIDDEN,
                #[cfg(feature = "ebpf")]
                CaptureError::EbpfLoadFailed(_) => StatusCode::INTERNAL_SERVER_ERROR,
                CaptureError::Other(_) => StatusCode::INTERNAL_SERVER_ERROR,
            };
            Self {
                status,
                error: err.to_string(),
            }
        }
    }

    pub async fn start_capture(
        State(state): State<Arc<AppState>>,
    ) -> Result<Json<MessageResponse>, ApiError> {
        let capture = state.capture.lock().await;
        capture.start(state.event_tx.clone());
        Ok(Json(MessageResponse {
            message: "Capture started".to_string(),
        }))
    }

    pub async fn stop_capture(
        State(state): State<Arc<AppState>>,
    ) -> Result<Json<MessageResponse>, ApiError> {
        let capture = state.capture.lock().await;
        capture.stop();
        Ok(Json(MessageResponse {
            message: "Capture stopped".to_string(),
        }))
    }

    pub async fn get_capture_status(
        State(state): State<Arc<AppState>>,
    ) -> Result<Json<CaptureStatusResponse>, ApiError> {
        let capture = state.capture.lock().await;
        let stats = capture.get_stats();
        Ok(Json(CaptureStatusResponse {
            is_capturing: capture.is_running(),
            stats,
            mode: capture.mode().to_string(),
        }))
    }

    pub async fn reset_capture(
        State(state): State<Arc<AppState>>,
    ) -> Result<Json<MessageResponse>, ApiError> {
        let capture = state.capture.lock().await;
        if capture.is_running() {
            capture.stop();
        }
        capture.reset();
        Ok(Json(MessageResponse {
            message: "Capture reset".to_string(),
        }))
    }

    pub async fn list_interfaces(
        State(state): State<Arc<AppState>>,
    ) -> Result<Json<Vec<String>>, ApiError> {
        let capture = state.capture.lock().await;
        Ok(Json(capture.list_interfaces()))
    }

    pub async fn attach_interface(
        State(state): State<Arc<AppState>>,
        Path(name): Path<String>,
    ) -> Result<Json<MessageResponse>, ApiError> {
        let capture = state.capture.lock().await;
        capture
            .attach_interface(&name)
            .await
            .map_err(ApiError::from)?;
        Ok(Json(MessageResponse {
            message: format!("Interface {} attached", name),
        }))
    }

    pub async fn detach_interface(
        State(state): State<Arc<AppState>>,
        Path(name): Path<String>,
    ) -> Result<Json<MessageResponse>, ApiError> {
        let capture = state.capture.lock().await;
        capture
            .detach_interface(&name)
            .await
            .map_err(ApiError::from)?;
        Ok(Json(MessageResponse {
            message: format!("Interface {} detached", name),
        }))
    }

    #[cfg(not(feature = "ebpf"))]
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct UpdateMockConfigRequest {
        pub interval_ms: Option<u64>,
        pub nic_drop_rate: Option<f64>,
        pub fw_drop_rate: Option<f64>,
        pub batch_size: Option<u32>,
        pub traffic_profile: Option<MockTrafficProfile>,
        pub dataset_size: Option<u32>,
    }

    #[cfg(not(feature = "ebpf"))]
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct MockConfigResponse {
        pub interval_ms: u64,
        pub nic_drop_rate: f64,
        pub fw_drop_rate: f64,
        pub batch_size: u32,
        pub traffic_profile: MockTrafficProfile,
        pub dataset_size: u32,
    }

    #[cfg(not(feature = "ebpf"))]
    pub async fn get_mock_config(
        State(state): State<Arc<AppState>>,
    ) -> Result<Json<MockConfigResponse>, ApiError> {
        let capture = state.capture.lock().await;
        let config = capture.get_mock_config();
        Ok(Json(MockConfigResponse {
            interval_ms: config.interval_ms,
            nic_drop_rate: config.nic_drop_rate,
            fw_drop_rate: config.fw_drop_rate,
            batch_size: config.batch_size,
            traffic_profile: config.traffic_profile,
            dataset_size: config.dataset_size,
        }))
    }

    #[cfg(not(feature = "ebpf"))]
    pub async fn update_mock_config(
        State(state): State<Arc<AppState>>,
        Json(req): Json<UpdateMockConfigRequest>,
    ) -> Result<Json<MockConfigResponse>, ApiError> {
        let capture = state.capture.lock().await;
        let config = capture
            .update_mock_config(
                req.interval_ms,
                req.nic_drop_rate,
                req.fw_drop_rate,
                req.batch_size,
                req.traffic_profile,
                req.dataset_size,
            )
            .map_err(ApiError::from)?;
        Ok(Json(MockConfigResponse {
            interval_ms: config.interval_ms,
            nic_drop_rate: config.nic_drop_rate,
            fw_drop_rate: config.fw_drop_rate,
            batch_size: config.batch_size,
            traffic_profile: config.traffic_profile,
            dataset_size: config.dataset_size,
        }))
    }
}

#[tokio::test]
async fn get_capture_status_returns_200() {
    let app = helpers::build_test_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/capture/status")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["isCapturing"], false);
    assert_eq!(json["mode"], "mock");
}

#[tokio::test]
async fn start_capture_returns_200() {
    let app = helpers::build_test_app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/capture/start")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json["message"].as_str().unwrap().contains("started"));
}

#[tokio::test]
async fn stop_capture_returns_200() {
    let app = helpers::build_test_app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/capture/stop")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn reset_capture_returns_200() {
    let app = helpers::build_test_app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/capture/reset")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn list_interfaces_returns_200() {
    let app = helpers::build_test_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/interfaces")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json.is_array());
    assert!(!json.as_array().unwrap().is_empty());
}

#[tokio::test]
async fn attach_interface_returns_200() {
    let app = helpers::build_test_app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/interfaces/eth0/attach")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json["message"].as_str().unwrap().contains("eth0"));
}

#[tokio::test]
async fn detach_interface_after_attach_returns_200() {
    let state = Arc::new(AppState::new());

    let api_routes = Router::new()
        .route(
            "/interfaces/{name}/attach",
            post(scrop_server_routes::attach_interface),
        )
        .route(
            "/interfaces/{name}/detach",
            post(scrop_server_routes::detach_interface),
        );

    let app = Router::new().nest("/api", api_routes).with_state(state);

    // Attach first
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/interfaces/eth0/attach")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // Then detach
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/interfaces/eth0/detach")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json["message"].as_str().unwrap().contains("eth0"));
}

#[tokio::test]
async fn start_then_status_shows_capturing() {
    let state = Arc::new(AppState::new());

    let api_routes = Router::new()
        .route("/capture/start", post(scrop_server_routes::start_capture))
        .route(
            "/capture/status",
            get(scrop_server_routes::get_capture_status),
        )
        .route("/capture/stop", post(scrop_server_routes::stop_capture));

    let app = Router::new().nest("/api", api_routes).with_state(state);

    // Start capture
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/capture/start")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // Check status
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/capture/status")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["isCapturing"], true);

    // Stop capture (cleanup)
    let _ = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/capture/stop")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
}

// --- Stateful integration tests for attach/packet-generation behavior ---

fn build_stateful_test_app() -> (Router, Arc<AppState>) {
    let state = Arc::new(AppState::new());

    let api_routes = Router::new()
        .route("/capture/start", post(scrop_server_routes::start_capture))
        .route("/capture/stop", post(scrop_server_routes::stop_capture))
        .route(
            "/capture/status",
            get(scrop_server_routes::get_capture_status),
        )
        .route("/capture/reset", post(scrop_server_routes::reset_capture))
        .route("/interfaces", get(scrop_server_routes::list_interfaces))
        .route(
            "/interfaces/{name}/attach",
            post(scrop_server_routes::attach_interface),
        )
        .route(
            "/interfaces/{name}/detach",
            post(scrop_server_routes::detach_interface),
        );

    #[cfg(not(feature = "ebpf"))]
    let api_routes = api_routes.route(
        "/mock/config",
        get(scrop_server_routes::get_mock_config).put(scrop_server_routes::update_mock_config),
    );

    let app = Router::new()
        .nest("/api", api_routes)
        .with_state(state.clone());

    (app, state)
}

async fn post_request(app: &Router, uri: &str) -> axum::http::Response<Body> {
    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap()
}

async fn get_request(app: &Router, uri: &str) -> axum::http::Response<Body> {
    app.clone()
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap()
}

#[cfg(not(feature = "ebpf"))]
async fn put_json_request(app: &Router, uri: &str, json_body: &str) -> axum::http::Response<Body> {
    app.clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from(json_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap()
}

async fn get_status_json(app: &Router) -> serde_json::Value {
    let response = get_request(app, "/api/capture/status").await;
    let body = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&body).unwrap()
}

#[tokio::test]
async fn attach_then_start_produces_packets() {
    let (app, _state) = build_stateful_test_app();

    // Attach interface
    let response = post_request(&app, "/api/interfaces/eth0/attach").await;
    assert_eq!(response.status(), StatusCode::OK);

    // Start capture
    let response = post_request(&app, "/api/capture/start").await;
    assert_eq!(response.status(), StatusCode::OK);

    // Poll for packets (up to 10 seconds)
    let mut found_packets = false;
    for _ in 0..20 {
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        let json = get_status_json(&app).await;
        if json["stats"]["totalPackets"].as_u64().unwrap_or(0) > 0 {
            found_packets = true;
            break;
        }
    }

    // Cleanup
    let _ = post_request(&app, "/api/capture/stop").await;
    assert!(
        found_packets,
        "Expected packets to be generated after attach + start"
    );
}

#[tokio::test]
async fn start_without_attach_produces_no_packets() {
    let (app, _state) = build_stateful_test_app();

    // Start capture without attaching any interface
    let response = post_request(&app, "/api/capture/start").await;
    assert_eq!(response.status(), StatusCode::OK);

    // Wait and verify no packets
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    let json = get_status_json(&app).await;
    let total = json["stats"]["totalPackets"].as_u64().unwrap_or(0);

    // Cleanup
    let _ = post_request(&app, "/api/capture/stop").await;
    assert_eq!(total, 0, "Expected no packets without attached interfaces");
}

#[tokio::test]
async fn detach_all_stops_packet_generation() {
    let (app, _state) = build_stateful_test_app();

    // Attach and start
    let _ = post_request(&app, "/api/interfaces/eth0/attach").await;
    let _ = post_request(&app, "/api/capture/start").await;

    // Wait for packets
    let mut found_packets = false;
    for _ in 0..20 {
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        let json = get_status_json(&app).await;
        if json["stats"]["totalPackets"].as_u64().unwrap_or(0) > 0 {
            found_packets = true;
            break;
        }
    }
    assert!(found_packets, "Should have received packets");

    // Detach and reset
    let _ = post_request(&app, "/api/interfaces/eth0/detach").await;
    let _ = post_request(&app, "/api/capture/reset").await;

    // Restart and verify no new packets
    let _ = post_request(&app, "/api/capture/start").await;
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    let json = get_status_json(&app).await;
    let total = json["stats"]["totalPackets"].as_u64().unwrap_or(0);

    // Cleanup
    let _ = post_request(&app, "/api/capture/stop").await;
    assert_eq!(
        total, 0,
        "Expected no packets after detaching all interfaces"
    );
}

#[tokio::test]
async fn attach_unknown_interface_returns_error() {
    let (app, _state) = build_stateful_test_app();

    let response = post_request(&app, "/api/interfaces/nonexistent/attach").await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn detach_unattached_interface_returns_error() {
    let (app, _state) = build_stateful_test_app();

    let response = post_request(&app, "/api/interfaces/eth0/detach").await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn double_attach_is_idempotent() {
    let (app, _state) = build_stateful_test_app();

    let response1 = post_request(&app, "/api/interfaces/eth0/attach").await;
    assert_eq!(response1.status(), StatusCode::OK);

    let response2 = post_request(&app, "/api/interfaces/eth0/attach").await;
    assert_eq!(response2.status(), StatusCode::OK);
}

// --- Mock config API tests ---

#[tokio::test]
#[cfg(not(feature = "ebpf"))]
async fn get_mock_config_returns_defaults() {
    let (app, _state) = build_stateful_test_app();

    let response = get_request(&app, "/api/mock/config").await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["intervalMs"], 2000);
    assert_eq!(json["nicDropRate"], 0.1);
    assert_eq!(json["fwDropRate"], 0.15);
    assert_eq!(json["batchSize"], 1);
    assert_eq!(json["trafficProfile"], "realistic");
    assert_eq!(json["datasetSize"], 65536);
}

#[tokio::test]
#[cfg(not(feature = "ebpf"))]
async fn put_mock_config_partial_update() {
    let (app, _state) = build_stateful_test_app();

    // Update only intervalMs
    let response = put_json_request(&app, "/api/mock/config", r#"{"intervalMs": 100}"#).await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["intervalMs"], 100);
    assert_eq!(json["nicDropRate"], 0.1);
    assert_eq!(json["fwDropRate"], 0.15);
    assert_eq!(json["trafficProfile"], "realistic");
    assert_eq!(json["datasetSize"], 65536);
}

#[tokio::test]
#[cfg(not(feature = "ebpf"))]
async fn put_mock_config_full_update() {
    let (app, _state) = build_stateful_test_app();

    let response = put_json_request(
        &app,
        "/api/mock/config",
        r#"{"intervalMs": 50, "nicDropRate": 0.3, "fwDropRate": 0.2}"#,
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["intervalMs"], 50);
    assert_eq!(json["nicDropRate"], 0.3);
    assert_eq!(json["fwDropRate"], 0.2);
    assert_eq!(json["trafficProfile"], "realistic");
    assert_eq!(json["datasetSize"], 65536);

    // Verify GET reflects the update
    let response = get_request(&app, "/api/mock/config").await;
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["intervalMs"], 50);
    assert_eq!(json["nicDropRate"], 0.3);
    assert_eq!(json["fwDropRate"], 0.2);
    assert_eq!(json["trafficProfile"], "realistic");
    assert_eq!(json["datasetSize"], 65536);
}

#[tokio::test]
#[cfg(not(feature = "ebpf"))]
async fn put_mock_config_validation_interval_zero() {
    let (app, _state) = build_stateful_test_app();

    let response = put_json_request(&app, "/api/mock/config", r#"{"intervalMs": 0}"#).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[cfg(not(feature = "ebpf"))]
async fn put_mock_config_validation_rate_out_of_range() {
    let (app, _state) = build_stateful_test_app();

    let response = put_json_request(&app, "/api/mock/config", r#"{"nicDropRate": 1.5}"#).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[cfg(not(feature = "ebpf"))]
async fn put_mock_config_validation_combined_rates_exceed_one() {
    let (app, _state) = build_stateful_test_app();

    let response = put_json_request(
        &app,
        "/api/mock/config",
        r#"{"nicDropRate": 0.6, "fwDropRate": 0.5}"#,
    )
    .await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[cfg(not(feature = "ebpf"))]
async fn put_mock_config_batch_size_update() {
    let (app, _state) = build_stateful_test_app();

    let response = put_json_request(&app, "/api/mock/config", r#"{"batchSize": 5}"#).await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["batchSize"], 5);
    // Other fields unchanged
    assert_eq!(json["intervalMs"], 2000);
    assert_eq!(json["nicDropRate"], 0.1);
    assert_eq!(json["fwDropRate"], 0.15);
    assert_eq!(json["trafficProfile"], "realistic");
    assert_eq!(json["datasetSize"], 65536);
}

#[tokio::test]
#[cfg(not(feature = "ebpf"))]
async fn put_mock_config_validation_batch_size_zero() {
    let (app, _state) = build_stateful_test_app();

    let response = put_json_request(&app, "/api/mock/config", r#"{"batchSize": 0}"#).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[cfg(not(feature = "ebpf"))]
async fn put_mock_config_traffic_profile_update() {
    let (app, _state) = build_stateful_test_app();

    let response = put_json_request(
        &app,
        "/api/mock/config",
        r#"{"trafficProfile":"bench","intervalMs": 50, "batchSize": 8, "datasetSize": 8192}"#,
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["trafficProfile"], "bench");
    assert_eq!(json["intervalMs"], 50);
    assert_eq!(json["batchSize"], 8);
    assert_eq!(json["datasetSize"], 8192);
}

#[tokio::test]
#[cfg(not(feature = "ebpf"))]
async fn put_mock_config_validation_dataset_size_zero() {
    let (app, _state) = build_stateful_test_app();

    let response = put_json_request(&app, "/api/mock/config", r#"{"datasetSize": 0}"#).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
