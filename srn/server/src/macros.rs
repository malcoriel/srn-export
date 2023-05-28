macro_rules! extract {
    ($enum_value:expr, $pattern:pat => $result:expr) => {
        match $enum_value {
            $pattern => $result,
            _ => unreachable!("impossible extraction"),
        }
    };
}
