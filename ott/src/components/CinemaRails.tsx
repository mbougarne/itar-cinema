import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  FocusScope,
  FocusVirtualizedRails as PackageRails,
  useFocusState,
  type VirtualizedFocusRail as PackageRail,
} from '@bougarnem/itar/react';

export type VirtualizedFocusRail = PackageRail & {
  horizontalAlignment?: 'nearest' | 'leading' | 'pinned';
  renderBody?: () => React.ReactNode;
  interactiveHeader?: boolean;
  rowExtent?: number;
  headerExtent?: number;
  revealGroup?: string;
  leadingExtent?: number;
};

type Props = Omit<
  React.ComponentProps<typeof PackageRails>,
  'rails' | 'renderRailHeader'
> & {
  rails: readonly VirtualizedFocusRail[];
  renderRailHeader?: (rail: VirtualizedFocusRail) => React.ReactNode;
  revealFullRow?: boolean;
};

// Cinema's custom shelves have different heights and may render their own
// controls. Compose one public Itar rail per shelf with the app's scroll view.
export function CinemaRails({ revealFullRow, ...props }: Props) {
  return revealFullRow ? (
    <MeasuredRails {...props} />
  ) : (
    <PackageRails {...props} />
  );
}

function MeasuredRails({
  id,
  active = true,
  rails,
  listHeader,
  listHeaderExtent = 0,
  listHeaderItems,
  rowExtent,
  headerExtent = 0,
  viewportExtent,
  viewportHeight = rowExtent,
  itemExtent,
  horizontalAlignment,
  rowEntry,
  renderDecoration,
  renderItem,
  renderRailHeader,
  onReady,
  style,
}: Omit<Props, 'revealFullRow'>) {
  const scroll = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const focus = useFocusState();
  const lastRow = useRef<string | undefined>(undefined);

  const rows = useMemo(() => {
    let top = listHeaderExtent;

    return rails.map(rail => {
      const height = rail.rowExtent ?? rowExtent;
      const row = { rail, top, height };

      top += height;

      return row;
    });
  }, [rails, listHeaderExtent, rowExtent]);

  useEffect(() => {
    if (active && viewportExtent > 0 && viewportHeight > 0) onReady?.();
  }, [active, onReady, viewportExtent, viewportHeight]);

  useLayoutEffect(() => {
    if (!active || !focus.occurrenceKey) return;

    if (
      listHeaderItems?.some(item => item.occurrenceKey === focus.occurrenceKey)
    ) {
      if (lastRow.current !== 'header')
        scroll.current?.scrollTo({ y: 0, animated: false });

      lastRow.current = 'header';

      return;
    }

    const row = rows.find(value =>
      value.rail.items.some(item => item.occurrenceKey === focus.occurrenceKey),
    );

    if (!row) {
      lastRow.current = undefined;

      return;
    }

    if (lastRow.current === row.rail.id) return;

    lastRow.current = row.rail.id;

    const group = row.rail.revealGroup
      ? rows.filter(value => value.rail.revealGroup === row.rail.revealGroup)
      : [row];

    const first = group[0] ?? row;
    const last = group[group.length - 1] ?? row;
    const groupedHeight = last.top + last.height - first.top;
    const top = groupedHeight <= viewportHeight ? first.top : row.top;
    const height = groupedHeight <= viewportHeight ? groupedHeight : row.height;
    const current = scrollOffset.current;

    const target =
      height >= viewportHeight || top < current
        ? top
        : Math.max(current, top + height - viewportHeight);

    if (current !== target)
      scroll.current?.scrollTo({ y: target, animated: false });
  }, [active, focus.occurrenceKey, listHeaderItems, rows, viewportHeight]);

  return (
    <FocusScope
      id={id}
      layout="column"
      boundary="parent"
      active={active}
      style={style}
    >
      <ScrollView
        ref={scroll}
        style={{ height: viewportHeight, width: viewportExtent }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScroll={event => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
        }}
      >
        {listHeader}
        {rows.map(({ rail, height }) => {
          const leading = rail.leadingExtent ?? 0;
          const heading = leading ? 0 : rail.headerExtent ?? headerExtent;
          const header = renderRailHeader?.(rail);
          const contentHeight = Math.max(1, height - heading);

          const items = rail.interactiveHeader
            ? rail.items.slice(0, -1)
            : rail.items;

          return (
            <View
              key={rail.id}
              style={[{ height }, leading > 0 && styles.leadingRow]}
            >
              {header != null && (
                <View
                  style={
                    leading
                      ? [styles.leadingLabel, { width: leading }]
                      : { height: heading }
                  }
                >
                  {header}
                </View>
              )}
              {rail.renderBody ? (
                <FocusScope id={rail.id} layout="row" boundary="parent">
                  {rail.renderBody()}
                </FocusScope>
              ) : items.length > 0 ? (
                <PackageRails
                  id={rail.id}
                  active={active}
                  rails={[
                    {
                      id: rail.id,
                      items,
                      itemStyle: rail.itemStyle,
                      overlayTarget: rail.overlayTarget,
                    },
                  ]}
                  itemExtent={rail.itemExtent ?? itemExtent}
                  rowExtent={contentHeight}
                  viewportExtent={viewportExtent - leading}
                  viewportHeight={contentHeight}
                  viewportRows={1}
                  rowEntry={rowEntry}
                  horizontalAlignment={
                    rail.horizontalAlignment ?? horizontalAlignment
                  }
                  renderDecoration={renderDecoration}
                  renderItem={renderItem}
                />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </FocusScope>
  );
}

const styles = StyleSheet.create({
  leadingRow: { flexDirection: 'row' },
  leadingLabel: { justifyContent: 'center' },
});
