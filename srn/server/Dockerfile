FROM alpine
WORKDIR /root
COPY resources resources
COPY Cargo.toml Cargo.toml
COPY Rocket.toml Rocket.toml
COPY src src
COPY target/x86_64-unknown-linux-musl target/x86_64-unknown-linux-musl
EXPOSE 2794
EXPOSE 8000
CMD ["./target/x86_64-unknown-linux-musl/release/srn-server"]
