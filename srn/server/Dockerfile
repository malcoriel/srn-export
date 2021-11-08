FROM alpine
WORKDIR /root
RUN chmod -R /home/rust
COPY resources resources
COPY Cargo.toml Cargo.toml
COPY Rocket.toml Rocket.toml
COPY src src
COPY target/x86_64-unknown-linux-musl/release ./release
EXPOSE 2794
EXPOSE 2795
EXPOSE 8000
LABEL autoheal=true
RUN apk --no-cache add curl
HEALTHCHECK --interval=3s --timeout=3s --retries=3 CMD curl --silent --show-error --fail localhost:8000/api/health || exit 1
ENV RUST_BACKTRACE=1
CMD ["./release/srn-server"]
