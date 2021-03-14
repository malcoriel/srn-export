type Uuid = string;

export type InventoryActionUnknown = { tag: "Unknown" };

export type InventoryActionSplit = {
  tag: "Split",
  from: Uuid,
  count: number,
};

export type InventoryActionMerge = {
  tag: "Merge",
  from: Uuid,
  to: number,
};

export type InventoryActionMove = {
  tag: "Move",
  item: Uuid,
  index: number,
};

export type InventoryAction = InventoryActionUnknown | InventoryActionSplit | InventoryActionMerge | InventoryActionMove;

export class InventoryActionBuilder {
  public static InventoryActionUnknown = (): InventoryActionUnknown => ({
    tag: 'Unknown',
  });

  public static InventoryActionSplit = ({
    from,
    count,
  }: {
    from: Uuid;
    count: number;
  }): InventoryActionSplit => ({
    tag: 'Split',
    from,
    count,
  });

  public static InventoryActionMerge = ({
    from,
    to,
  }: {
    from: Uuid;
    to: number;
  }): InventoryActionMerge => ({
    tag: 'Merge',
    from,
    to,
  });

  public static InventoryActionMove = ({
    item,
    index,
  }: {
    item: Uuid;
    index: number;
  }): InventoryActionMove => ({
    tag: 'Move',
    item,
    index,
  });
}
