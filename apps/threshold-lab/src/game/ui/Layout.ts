export type Rect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type LayoutMode = "compact" | "regular" | "wide";

export function layoutMode(width: number, height: number): LayoutMode {
  if (width < 520 || height < 430) return "compact";
  if (width >= 900) return "wide";
  return "regular";
}

const inset = (width: number): number =>
  Math.max(12, Math.min(28, width * 0.04));

export type MenuLayout = Readonly<{
  mode: LayoutMode;
  content: Rect;
  titleY: number;
  subtitleY: number;
  buttons: readonly Rect[];
}>;

export function computeMenuLayout(
  width: number,
  height: number,
  buttonCount: number,
): MenuLayout {
  const mode = layoutMode(width, height);
  const margin = inset(width);
  const contentWidth = Math.min(
    mode === "wide" ? 520 : 420,
    width - margin * 2,
  );
  const buttonHeight = mode === "compact" && height < 560 ? 48 : 56;
  const gap = mode === "compact" ? 10 : 14;
  const stackHeight =
    buttonCount * buttonHeight + Math.max(0, buttonCount - 1) * gap;
  const titleY = Math.max(42, height * (mode === "wide" ? 0.2 : 0.14));
  const subtitleY = titleY + (mode === "compact" ? 56 : 70);
  const stackTop = Math.max(
    subtitleY + 52,
    Math.min(height - margin - stackHeight, height * 0.43),
  );
  return {
    mode,
    content: {
      x: (width - contentWidth) / 2,
      y: margin,
      width: contentWidth,
      height: height - margin * 2,
    },
    titleY,
    subtitleY,
    buttons: Array.from({ length: buttonCount }, (_, index) => ({
      x: (width - contentWidth) / 2,
      y: stackTop + index * (buttonHeight + gap),
      width: contentWidth,
      height: buttonHeight,
    })),
  };
}

export type EncounterLayoutOptions = Readonly<{
  tileCount: number;
  debugOpen: boolean;
  resolved: boolean;
}>;

export type EncounterLayout = Readonly<{
  mode: LayoutMode;
  header: Rect;
  hud: Rect;
  board: Rect;
  actions: Rect;
  feedback: Rect;
  details?: Rect;
  columns: number;
  tileSize: number;
  gap: number;
}>;

export function computeEncounterLayout(
  width: number,
  height: number,
  options: EncounterLayoutOptions,
): EncounterLayout {
  const mode = layoutMode(width, height);
  const margin = inset(width);
  const compactLandscape = height < 430 && width > height;
  const headerHeight = compactLandscape ? 48 : 58;
  const hudHeight = compactLandscape ? 54 : 72;
  const actionsHeight = 58;
  const feedbackHeight =
    options.resolved || options.debugOpen ? (compactLandscape ? 94 : 122) : 42;
  const bottom = margin + actionsHeight + feedbackHeight;
  const contentTop = margin + headerHeight + hudHeight;
  const detailsWidth =
    options.debugOpen && width >= 760 ? Math.min(300, width * 0.3) : 0;
  const boardWidth =
    width - margin * 2 - (detailsWidth ? detailsWidth + margin : 0);
  const boardHeight = Math.max(70, height - contentTop - bottom);
  const columns = compactLandscape ? 6 : width >= 760 ? 6 : 4;
  const rows = Math.ceil(options.tileCount / columns);
  const gap = mode === "compact" ? 6 : 10;
  const tileSize = Math.max(
    38,
    Math.min(
      92,
      (boardWidth - gap * (columns - 1)) / columns,
      (boardHeight - gap * (rows - 1)) / rows,
    ),
  );
  return {
    mode,
    header: {
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: headerHeight,
    },
    hud: {
      x: margin,
      y: margin + headerHeight,
      width: width - margin * 2,
      height: hudHeight,
    },
    board: { x: margin, y: contentTop, width: boardWidth, height: boardHeight },
    actions: {
      x: margin,
      y: height - margin - actionsHeight - feedbackHeight,
      width: width - margin * 2,
      height: actionsHeight,
    },
    feedback: {
      x: margin,
      y: height - margin - feedbackHeight,
      width: width - margin * 2,
      height: feedbackHeight,
    },
    ...(detailsWidth
      ? {
          details: {
            x: width - margin - detailsWidth,
            y: contentTop,
            width: detailsWidth,
            height: boardHeight,
          },
        }
      : {}),
    columns,
    tileSize,
    gap,
  };
}

export type ShopLayoutOptions = Readonly<{
  offerCount: number;
  inventoryCount: number;
}>;
export type ShopLayout = Readonly<{
  mode: LayoutMode;
  header: Rect;
  offers: readonly Rect[];
  inventory: Rect;
  feedback: Rect;
  actions: Rect;
}>;

export function computeShopLayout(
  width: number,
  height: number,
  options: ShopLayoutOptions,
): ShopLayout {
  const mode = layoutMode(width, height);
  const margin = inset(width);
  const landscape = height < 520 && width > height;
  const header: Rect = {
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: landscape ? 52 : 70,
  };
  const actionsHeight = 58;
  const feedbackHeight = 30;
  const inventoryHeight = landscape
    ? 58
    : Math.min(118, 38 + Math.min(options.inventoryCount, 4) * 22);
  const actions: Rect = {
    x: margin,
    y: height - margin - actionsHeight,
    width: width - margin * 2,
    height: actionsHeight,
  };
  const feedback: Rect = {
    x: margin,
    y: actions.y - feedbackHeight,
    width: actions.width,
    height: feedbackHeight,
  };
  const inventory: Rect = {
    x: margin,
    y: feedback.y - inventoryHeight,
    width: actions.width,
    height: inventoryHeight,
  };
  const offerTop = header.y + header.height + 8;
  const offerBottom = inventory.y - 8;
  const gap = 10;
  const horizontal = landscape || width >= 900;
  const offerWidth = horizontal
    ? (width - margin * 2 - gap * (options.offerCount - 1)) / options.offerCount
    : width - margin * 2;
  const offerHeight = horizontal
    ? offerBottom - offerTop
    : (offerBottom - offerTop - gap * (options.offerCount - 1)) /
      options.offerCount;
  return {
    mode,
    header,
    offers: Array.from({ length: options.offerCount }, (_, index) => ({
      x: horizontal ? margin + index * (offerWidth + gap) : margin,
      y: horizontal ? offerTop : offerTop + index * (offerHeight + gap),
      width: offerWidth,
      height: offerHeight,
    })),
    inventory,
    feedback,
    actions,
  };
}
