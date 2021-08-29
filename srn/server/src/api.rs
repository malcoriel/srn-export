use pkg_version::*;
use rocket::http::Status;
use rocket_contrib::json::Json;

const MAJOR: u32 = pkg_version_major!();
const MINOR: u32 = pkg_version_minor!();
const PATCH: u32 = pkg_version_patch!();

#[get("/version")]
pub fn get_version() -> Json<String> {
    let version = format!("{}.{}.{}", MAJOR, MINOR, PATCH);
    Json(version)
}

#[get("/health")]
pub fn get_health() -> Status {
    let is_ok = crate::STATE.read().is_ok();
    return if is_ok {
        Status::Ok
    } else {
        Status::InternalServerError
    };
}

#[head("/health")]
pub fn head_health() -> Status {
    let is_ok = crate::STATE.read().is_ok();
    return if is_ok {
        Status::Ok
    } else {
        Status::InternalServerError
    };
}
