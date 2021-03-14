type Uuid = string;

type InventoryActionUnknown = { tag: 'Unknown' };
type InventoryActionSplit = {
  tag: 'Split';
  from: Uuid;
  count: number;
  to_index: number;
};
type InventoryActionMerge = { tag: 'Merge'; from: Uuid; to: Uuid };
type InventoryActionMove = { tag: 'Move'; item: Uuid; index: number };

export type InventoryAction =
  | InventoryActionUnknown
  | InventoryActionSplit
  | InventoryActionMerge
  | InventoryActionMove;

export class InventoryActionBuilder {
  public static InventoryActionUnknown = (): InventoryActionUnknown => ({
    tag: 'Unknown',
  });

  public static InventoryActionSplit = ({
    from,
    count,
    to_index,
  }: {
    from: Uuid;
    count: number;
    to_index: number;
  }): InventoryActionSplit => ({
    tag: 'Split',
    from,
    count,
    to_index,
  });

  public static InventoryActionMerge = ({
    from,
    to,
  }: {
    from: Uuid;
    to: Uuid;
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
