pub fn declare() {
    let app_version: Option<&'static str> = option_env!("APP_VERSION");
    let app_version = app_version.unwrap_or("unknown");
    let git_version: Option<&'static str> = option_env!("GIT_VERSION");
    let git_version = git_version.unwrap_or("unknown");
    let build_method: Option<&'static str> = option_env!("BUILD_METHOD");
    let build_method = build_method.unwrap_or("unknown");
    let build_opt: Option<&'static str> = option_env!("BUILD_OPT");
    let build_opt = build_opt.unwrap_or("unknown");
    let git_local_changes: Option<&'static str> = option_env!("GIT_LOCAL_CHANGES");
    let git_local_changes = git_local_changes.unwrap_or("unknown");

    log!(format!(
        r##"
app_version: {app_version}
git_version: {git_version}
git_local_changes: {git_local_changes}
build_method: {build_method}
build_opt: {build_opt}"##
    ))
}
