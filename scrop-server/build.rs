fn main() {
    println!("cargo:rerun-if-changed=../proto/packet_stream.proto");

    let protoc_path = protoc_bin_vendored::protoc_bin_path().expect("failed to find protoc");

    let mut config = prost_build::Config::new();
    config.protoc_executable(protoc_path);
    config
        .compile_protos(&["../proto/packet_stream.proto"], &["../proto"])
        .expect("failed to compile protobuf schema");
}
