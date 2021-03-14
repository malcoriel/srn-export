type Uuid = string;

type InventoryActionUnknown = { tag: "Unknown" };

type InventoryActionSplit = {
  tag: "Split",
  from: Uuid,
  count: number,
};

type InventoryActionMerge = {
  tag: "Merge",
  from: Uuid,
  to: number,
};

type InventoryActionMove = {
  tag: "Move",
  item: Uuid,
  index: number,
};

export type InventoryAction = InventoryActionUnknown | InventoryActionSplit | InventoryActionMerge | InventoryActionMove;
