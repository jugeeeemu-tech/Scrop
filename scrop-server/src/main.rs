mod routes;
mod ws;
mod ws_proto;

#[cfg(debug_assertions)]
use std::path::Path;
use std::sync::Arc;

use axum::http::{header, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use clap::Parser;
#[cfg(not(debug_assertions))]
use rust_embed::Embed;
use tracing::{info, Level};
use tracing_subscriber::filter::{filter_fn, LevelFilter};
use tracing_subscriber::prelude::*;
use tracing_subscriber::{fmt, EnvFilter};

use scrop_capture::AppState;

#[cfg(not(debug_assertions))]
#[derive(Embed)]
#[folder = "../dist/"]
struct Assets;

#[derive(Parser)]
#[command(name = "scrop-server", about = "Scrop packet capture web server")]
struct Cli {
    /// Host address to bind to
    #[arg(long, default_value = "127.0.0.1")]
    host: String,

    /// Port to listen on
    #[arg(long, default_value_t = 3000)]
    port: u16,
}

fn init_tracing() {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    let _ = tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::layer()
                .with_writer(std::io::stdout)
                .with_filter(filter_fn(|metadata| *metadata.level() <= Level::INFO)),
        )
        .with(
            fmt::layer()
                .with_writer(std::io::stderr)
                .with_filter(LevelFilter::WARN),
        )
        .try_init();
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    // Try the exact path first
    if let Some(content) = load_asset(path) {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        return Response::builder()
            .header(header::CONTENT_TYPE, mime.as_ref())
            .body(axum::body::Body::from(content))
            .unwrap();
    }

    // SPA fallback: serve index.html for unknown paths
    if let Some(content) = load_asset("index.html") {
        return Response::builder()
            .header(header::CONTENT_TYPE, "text/html")
            .body(axum::body::Body::from(content))
            .unwrap();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(axum::body::Body::from("Not Found"))
        .unwrap()
}

#[cfg(not(debug_assertions))]
fn load_asset(path: &str) -> Option<Vec<u8>> {
    Assets::get(path).map(|content| content.data.into_owned())
}

#[cfg(debug_assertions)]
fn load_asset(path: &str) -> Option<Vec<u8>> {
    let asset_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../dist")
        .join(path);
    std::fs::read(asset_path).ok()
}

#[tokio::main]
async fn main() {
    init_tracing();

    let cli = Cli::parse();

    #[cfg(feature = "ebpf")]
    if let Err(e) = scrop_capture::check_permissions() {
        tracing::error!(error = %e, "permission check failed");
        std::process::exit(1);
    }

    let state = Arc::new(AppState::new());

    let api_routes = Router::new()
        .route("/capture/start", post(routes::start_capture))
        .route("/capture/stop", post(routes::stop_capture))
        .route("/capture/status", get(routes::get_capture_status))
        .route("/capture/reset", post(routes::reset_capture))
        .route("/interfaces", get(routes::list_interfaces))
        .route("/interfaces/{name}/attach", post(routes::attach_interface))
        .route("/interfaces/{name}/detach", post(routes::detach_interface));

    #[cfg(not(feature = "ebpf"))]
    let api_routes = api_routes.route(
        "/mock/config",
        get(routes::get_mock_config).put(routes::update_mock_config),
    );

    let app = Router::new()
        .nest("/api", api_routes)
        .route("/ws", get(ws::ws_handler))
        .fallback(get(static_handler))
        .with_state(state);

    let addr = format!("{}:{}", cli.host, cli.port);
    info!(addr = %addr, "scrop server listening");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind address");

    axum::serve(listener, app).await.expect("Server error");
}
