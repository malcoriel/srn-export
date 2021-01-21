FROM nginx:alpine
WORKDIR /root
COPY build /usr/share/nginx/html
COPY docker/default.conf /etc/nginx/conf.d/
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
