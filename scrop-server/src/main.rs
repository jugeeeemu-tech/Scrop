mod routes;
mod ws;

use std::sync::Arc;

use axum::http::{StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use clap::Parser;
use rust_embed::Embed;

use scrop_capture::AppState;

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

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    // Try the exact path first
    if let Some(content) = Assets::get(path) {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        return Response::builder()
            .header(header::CONTENT_TYPE, mime.as_ref())
            .body(axum::body::Body::from(content.data.to_vec()))
            .unwrap();
    }

    // SPA fallback: serve index.html for unknown paths
    if let Some(content) = Assets::get("index.html") {
        return Response::builder()
            .header(header::CONTENT_TYPE, "text/html")
            .body(axum::body::Body::from(content.data.to_vec()))
            .unwrap();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(axum::body::Body::from("Not Found"))
        .unwrap()
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    #[cfg(feature = "ebpf")]
    if let Err(e) = scrop_capture::check_permissions() {
        eprintln!("Error: {}", e);
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

    let app = Router::new()
        .nest("/api", api_routes)
        .route("/ws", get(ws::ws_handler))
        .fallback(get(static_handler))
        .with_state(state);

    let addr = format!("{}:{}", cli.host, cli.port);
    eprintln!("Scrop server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind address");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}
