use serde::de::SeqAccess;
use serde::ser::SerializeSeq;
use uuid::Uuid;
use crate::{GameState, world};

pub struct ReplayFrame {
    pub state: GameState
}

pub struct ReplaySlice {
    pub frames: Vec<ReplayFrame>
}

pub struct FullReplay(ReplaySlice);

pub struct GameStateDiff {

}

pub struct ReplayDiffed {
    pub initial: GameState,
    pub diffs: Vec<GameStateDiff>
}

