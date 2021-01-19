#[cfg(test)]
mod vec2_test {
    use crate::vec2::Vec2f64;
    use std::f64::consts::PI;

    #[test]
    fn can_rotate() {
        let vec2_base = Vec2f64 { x: 1.0, y: 0.0 };
        let new_vec2 = vec2_base.rotate(PI / 2.0);
        assert!((new_vec2.x - 0.0).abs() < 0.00001);
        println!("{}", new_vec2.y);
        assert!((new_vec2.y + 1.0).abs() < 0.00001);

        let new_vec2 = vec2_base.rotate(PI);
        assert!((new_vec2.x + 1.0) < 0.00001);
        assert!((new_vec2.y - 0.0).abs() < 0.00001);

        let new_vec2 = vec2_base.rotate(PI / 2.0 * 3.0);
        assert!((new_vec2.x - 0.0) < 0.00001);
        assert!((new_vec2.y - 1.0).abs() < 0.00001);

        let vec2_long = Vec2f64 { x: 5.0, y: 0.0 };
        let vec_long_new = vec2_long.rotate(PI / 2.0);
        assert!((vec_long_new.x - 0.0).abs() < 0.00001);
        assert!((vec_long_new.y + 5.0).abs() < 0.00001);
    }
}
