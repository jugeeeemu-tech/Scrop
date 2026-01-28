fn main() {
    #[cfg(feature = "ebpf")]
    build_ebpf();

    tauri_build::build()
}

#[cfg(feature = "ebpf")]
fn build_ebpf() {
    use std::env;
    use std::path::{Path, PathBuf};
    use std::process::Command;

    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let ebpf_dir = Path::new(&manifest_dir).parent().unwrap().join("scrop-ebpf");
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    println!("cargo:rerun-if-changed={}", ebpf_dir.join("src").display());
    println!(
        "cargo:rerun-if-changed={}",
        ebpf_dir.join("Cargo.toml").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        Path::new(&manifest_dir)
            .parent()
            .unwrap()
            .join("scrop-common/src")
            .display()
    );

    let status = Command::new("rustup")
        .args([
            "run",
            "nightly",
            "cargo",
            "build",
            "--release",
            "--target=bpfel-unknown-none",
            "-Z",
            "build-std=core",
        ])
        .env_remove("RUSTC")
        .env_remove("RUSTC_WORKSPACE_WRAPPER")
        .current_dir(&ebpf_dir)
        .status()
        .expect("failed to run rustup");

    if !status.success() {
        panic!("eBPF program build failed");
    }

    let ebpf_bin = ebpf_dir.join("target/bpfel-unknown-none/release/scrop-ebpf");
    let dest = out_dir.join("scrop-ebpf");
    std::fs::copy(&ebpf_bin, &dest).unwrap_or_else(|e| {
        panic!(
            "failed to copy eBPF binary from {} to {}: {}",
            ebpf_bin.display(),
            dest.display(),
            e
        )
    });
}
