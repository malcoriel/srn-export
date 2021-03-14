// export class InventoryActionBuilder {
//   public static InventoryActionUnknown = (): InventoryActionUnknown => ({
//     tag: 'Unknown',
//   });
//
//   public static InventoryActionSplit = ({
//     from,
//     count,
//   }: {
//     from: Uuid;
//     count: number;
//   }): InventoryActionSplit => ({
//     tag: 'Split',
//     from,
//     count,
//   });
//
//   public static InventoryActionMerge = ({
//     from,
//     to,
//   }: {
//     from: Uuid;
//     to: Uuid;
//   }): InventoryActionMerge => ({
//     tag: 'Merge',
//     from,
//     to,
//   });
//
//   public static InventoryActionMove = ({
//     item,
//     index,
//   }: {
//     item: Uuid;
//     index: number;
//   }): InventoryActionMove => ({
//     tag: 'Move',
//     item,
//     index,
//   });
// }
