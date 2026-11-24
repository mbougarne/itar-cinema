import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  Focusable,
  FocusScope,
  FocusVirtualizedRails as PackageRails,
  occurrenceKey,
  useFocusState,
  type VirtualizedFocusRail as PackageRail,
} from '@bougarnem/itar/react';
import { useBrowserFocusRoute } from '../browser-navigation';

export type VirtualizedFocusRail = PackageRail & {
  horizontalAlignment?: 'nearest' | 'leading' | 'pinned';
  renderBody?: () => React.ReactNode;
  interactiveHeader?: boolean;
  rowExtent?: number;
  headerExtent?: number;
  revealGroup?: string;
  leadingExtent?: number;
  contentInsetStart?: number;
};

type Props = Omit<
  React.ComponentProps<typeof PackageRails>,
  'rails' | 'renderRailHeader'
> & {
  rails: readonly VirtualizedFocusRail[];
  renderRailHeader?: (rail: VirtualizedFocusRail) => React.ReactNode;
  revealFullRow?: boolean;
  rtl?: boolean;
  headerReturnKey?: string;
  headerExitKeys?: readonly string[];
};

// Cinema's custom shelves have different heights and may render their own
// controls. Compose one public Itar rail per shelf with the app's scroll view.
export function CinemaRails({ revealFullRow, rtl, ...props }: Props) {
  return revealFullRow ? (
    <MeasuredRails {...props} rtl={rtl} />
  ) : (
    <PackageRails {...props} />
  );
}

function MeasuredRails({
  id,
  rtl,
  active = true,
  rails,
  listHeader,
  listHeaderExtent = 0,
  listHeaderItems,
  headerReturnKey,
  headerExitKeys,
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
  const rtlWeb = !!rtl && Platform.OS === 'web';
  const scroll = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const focus = useFocusState();
  const lastRow = useRef<string | undefined>(undefined);
  const rowFocus = useRef(new Map<string, string>());

  const rows = useMemo(() => {
    let top = listHeaderExtent;

    return rails.map(rail => {
      const height = rail.rowExtent ?? rowExtent;
      const row = { rail, top, height };

      top += height;

      return row;
    });
  }, [rails, listHeaderExtent, rowExtent]);

  useBrowserFocusRoute(
    active && !!listHeaderItems?.length,
    (key, direction) => {
      const horizontal =
        direction === 'ArrowLeft' || direction === 'ArrowRight';

      if (horizontal && !rtlWeb) return;

      const focusableRows = rails.filter(rail =>
        rail.items.some(item => item.enabled !== false),
      );

      const rowIndex = focusableRows.findIndex(rail =>
        rail.items.some(item => item.occurrenceKey === key),
      );

      if (horizontal) {
        const items = focusableRows[rowIndex]?.items.filter(
          item => item.enabled !== false,
        );

        if (!items) return;

        const index = items.findIndex(item => item.occurrenceKey === key);
        const next = items[index + (direction === 'ArrowLeft' ? 1 : -1)];

        return (
          next?.occurrenceKey ??
          (direction === 'ArrowRight' ? occurrenceKey('nav', 'Home') : false)
        );
      }

      const atHeader = headerExitKeys
        ? headerExitKeys.includes(key)
        : listHeaderItems?.some(item => item.occurrenceKey === key);

      if (rowIndex < 0 && (!atHeader || direction !== 'ArrowDown')) return;

      const next = focusableRows[rowIndex + (direction === 'ArrowUp' ? -1 : 1)];

      if (!next) return direction === 'ArrowUp' ? headerReturnKey : undefined;

      const remembered = rowFocus.current.get(next.id);
      const enabled = next.items.filter(item => item.enabled !== false);

      return (
        enabled.find(item => item.occurrenceKey === remembered)
          ?.occurrenceKey ?? enabled[0]?.occurrenceKey
      );
    },
  );

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

    rowFocus.current.set(row.rail.id, focus.occurrenceKey);

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
        {listHeader && (
          <FocusScope
            id="00-header"
            boundary="parent"
            restoreOnEntry
            preferredKey={headerReturnKey}
          >
            {listHeader}
          </FocusScope>
        )}
        {rows.map(({ rail, height }, index) => {
          const leading = rail.leadingExtent ?? 0;
          const inset = rail.contentInsetStart ?? 0;
          const heading = leading ? 0 : rail.headerExtent ?? headerExtent;
          const header = renderRailHeader?.(rail);
          const contentHeight = Math.max(1, height - heading);
          const rowWidth = viewportExtent - leading - inset;
          const cellWidth = rail.itemExtent ?? itemExtent;
          const alignment = rail.horizontalAlignment ?? horizontalAlignment;

          const items = rail.interactiveHeader
            ? rail.items.slice(0, -1)
            : rail.items;

          return (
            <FocusScope
              key={rail.id}
              id={String(index + 1).padStart(3, '0') + '-' + rail.id}
              boundary="parent"
              restoreOnEntry={!!listHeaderItems?.length}
              preferredKey={
                rail.items.find(item => item.enabled !== false)?.occurrenceKey
              }
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
              ) : items.length > 0 && rtlWeb && alignment === 'nearest' ? (
                // The published rail's nearest alignment lays cells out from
                // the left. These short shelves use regular RTL flow instead.
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{
                    marginStart: inset,
                    width: rowWidth,
                    height: contentHeight,
                  }}
                >
                  {items.map((item, itemIndex) => (
                    <View key={item.occurrenceKey} style={{ width: cellWidth }}>
                      {renderDecoration?.(item)}
                      <Focusable
                        {...item}
                        order={itemIndex}
                        style={[
                          { width: cellWidth, height: contentHeight },
                          rail.itemStyle,
                        ]}
                      >
                        {renderItem
                          ? renderItem(item, itemIndex)
                          : item.children}
                      </Focusable>
                    </View>
                  ))}
                </ScrollView>
              ) : items.length > 0 ? (
                <PackageRails
                  id={rail.id}
                  style={inset ? { marginStart: inset } : undefined}
                  active={active}
                  rails={[
                    {
                      id: rail.id,
                      items,
                      itemStyle: rail.itemStyle,
                      overlayTarget: rail.overlayTarget,
                    },
                  ]}
                  itemExtent={cellWidth}
                  rowExtent={contentHeight}
                  viewportExtent={rowWidth}
                  viewportHeight={contentHeight}
                  viewportRows={1}
                  rowEntry={rowEntry}
                  horizontalAlignment={alignment}
                  renderDecoration={renderDecoration}
                  renderItem={renderItem}
                />
              ) : null}
            </FocusScope>
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
