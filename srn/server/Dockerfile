FROM liuchong/rustup:stable
RUN apt-get update && apt-get install coz-profiler -y
RUN apt-get install valgrind -y
RUN apt-get install python3 graphviz -y
RUN cargo install cargo-profiler
WORKDIR /root
COPY . .
EXPOSE 2794
EXPOSE 8000
CMD /bin/bash
