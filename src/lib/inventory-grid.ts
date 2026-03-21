/**
 * Inventory Grid — Collision detection & grid utilities.
 * Shared between server (API validation) and client (UI preview).
 */

export interface GridItem {
  id: string;
  posX: number;
  posY: number;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Checks if placing an item would collide with existing items or exceed grid bounds.
 * Returns true if there IS a collision (placement invalid).
 */
export function checkCollision(
  items: GridItem[],
  placing: GridItem,
  gridWidth: number,
  gridHeight: number,
  excludeId?: string
): boolean {
  // Bounds check
  if (
    placing.posX < 0 ||
    placing.posY < 0 ||
    placing.posX + placing.gridWidth > gridWidth ||
    placing.posY + placing.gridHeight > gridHeight
  ) {
    return true;
  }

  // Build set of occupied cells (excluding the item being moved)
  const occupied = new Set<string>();
  for (const item of items) {
    if (item.id === excludeId) continue;
    for (let x = item.posX; x < item.posX + item.gridWidth; x++) {
      for (let y = item.posY; y < item.posY + item.gridHeight; y++) {
        occupied.add(`${x},${y}`);
      }
    }
  }

  // Check if placing item overlaps with occupied cells
  for (let x = placing.posX; x < placing.posX + placing.gridWidth; x++) {
    for (let y = placing.posY; y < placing.posY + placing.gridHeight; y++) {
      if (occupied.has(`${x},${y}`)) return true;
    }
  }

  return false;
}

/**
 * Builds a 2D boolean grid where true = occupied cell.
 * Used by client for visual rendering.
 */
export function buildOccupancyGrid(
  items: GridItem[],
  gridWidth: number,
  gridHeight: number
): boolean[][] {
  const grid: boolean[][] = Array.from({ length: gridHeight }, () =>
    Array(gridWidth).fill(false)
  );

  for (const item of items) {
    for (let y = item.posY; y < item.posY + item.gridHeight; y++) {
      for (let x = item.posX; x < item.posX + item.gridWidth; x++) {
        if (y < gridHeight && x < gridWidth) {
          grid[y][x] = true;
        }
      }
    }
  }

  return grid;
}

/**
 * Finds the first free slot that can fit an item of given dimensions.
 * Scans left-to-right, top-to-bottom. Returns null if no space.
 */
export function findFreeSlot(
  items: GridItem[],
  itemWidth: number,
  itemHeight: number,
  gridWidth: number,
  gridHeight: number
): { x: number; y: number } | null {
  const occupancy = buildOccupancyGrid(items, gridWidth, gridHeight);

  for (let y = 0; y <= gridHeight - itemHeight; y++) {
    for (let x = 0; x <= gridWidth - itemWidth; x++) {
      let fits = true;
      for (let dy = 0; dy < itemHeight && fits; dy++) {
        for (let dx = 0; dx < itemWidth && fits; dx++) {
          if (occupancy[y + dy][x + dx]) fits = false;
        }
      }
      if (fits) return { x, y };
    }
  }

  return null;
}
