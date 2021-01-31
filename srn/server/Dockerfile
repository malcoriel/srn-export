FROM alpine
WORKDIR /root
COPY resources resources
COPY Cargo.toml Cargo.toml
COPY Rocket.toml Rocket.toml
COPY src src
COPY target/x86_64-unknown-linux-musl/release ./release
EXPOSE 2794
EXPOSE 2795
EXPOSE 8000
CMD ["./release/srn-server"]
