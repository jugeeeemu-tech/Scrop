fn main() {
    #[cfg(feature = "ebpf")]
    build_ebpf();
}

#[cfg(feature = "ebpf")]
fn build_ebpf() {
    use std::env;
    use std::path::{Path, PathBuf};
    use std::process::Command;

    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let project_root = Path::new(&manifest_dir).parent().unwrap();
    let ebpf_src_dir = project_root.join("scrop-ebpf").join("src");
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    let source_path = ebpf_src_dir.join("scrop.bpf.c");
    let include_dir = ebpf_src_dir.to_str().unwrap();
    let output_path = out_dir.join("scrop-ebpf");

    println!("cargo:rerun-if-changed={}", source_path.display());
    println!(
        "cargo:rerun-if-changed={}",
        ebpf_src_dir.join("vmlinux.h").display()
    );

    let status = Command::new("clang")
        .args([
            "-target",
            "bpf",
            "-D__TARGET_ARCH_x86",
            "-O2",
            "-g",
            "-I",
            include_dir,
            "-c",
            source_path.to_str().unwrap(),
            "-o",
            output_path.to_str().unwrap(),
        ])
        .status()
        .expect("failed to run clang — is clang installed?");

    if !status.success() {
        panic!("eBPF program build failed (clang)");
    }
}
