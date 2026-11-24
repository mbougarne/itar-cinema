import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  FocusScope,
  FocusVirtualizedRails,
  occurrenceKey,
  useFocusState,
} from '@bougarnem/itar/react';
import Browse from './Browse';
import type { BrowseProps } from './browse-types';
import { categories, type Category, type CatalogueSort } from './catalog-types';
import { Action } from './components/Action';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { useBrowserFocusRoute } from './browser-navigation';

export default function Catalogue(props: BrowseProps) {
  const { t } = useCinemaLanguage();
  const { s, u } = useDesign();
  const { width } = useWindowDimensions();
  const [filterWidth, setFilterWidth] = useState(0);
  const [category, setCategory] = useState<Category>('All');
  const [sort, setSort] = useState<CatalogueSort>('popular');
  const { id, onReady } = props;

  const sorts = [
    ['popular', 'Popular', 138],
    ['az', 'A–Z', 90],
    ['za', 'Z–A', 90],
    ['newest', 'Newest releases', 230],
  ] as const;

  const reportReady = useCallback(
    () => onReady?.(occurrenceKey(id, 'category', 'All')),
    [id, onReady],
  );

  const genres = useMemo(
    () => [
      {
        id: 'genres',
        itemStyle: s.genreFilter,
        items: categories
          .filter(name =>
            props.kind === 'movie'
              ? !['News', 'Reality', 'Soap', 'Talk'].includes(name)
              : !['History', 'Horror', 'Music', 'Romance', 'Thriller'].includes(
                  name,
                ),
          )
          .map(name => ({
            occurrenceKey: occurrenceKey(id, 'category', name),
            accessibilityLabel: t(
              name === category ? name + ', selected' : name,
            ),
            displayLabel: name === category ? '✓  ' + t(name) : t(name),
            labelSize: 23 * u,
            focusStyle: { accentColor: '#FFFFFF' },
            onPress: () => setCategory(name),
          })),
      },
    ],
    [category, id, props.kind, s.genreFilter, t, u],
  );

  const { occurrenceKey: focusedKey } = useFocusState();
  const sortKeys = sorts.map(([name]) => occurrenceKey(id, 'sort', name));
  const genreKeys = genres[0].items.map(item => item.occurrenceKey);
  const lastSort = useRef<string | undefined>(undefined);
  const lastGenre = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!props.active || !focusedKey) return;

    if (sortKeys.includes(focusedKey)) lastSort.current = focusedKey;

    if (genreKeys.includes(focusedKey)) lastGenre.current = focusedKey;
  }, [focusedKey, genreKeys, props.active, sortKeys]);

  const sortEntry = lastSort.current ?? occurrenceKey(id, 'sort', sort);

  const genreEntry =
    lastGenre.current ?? occurrenceKey(id, 'category', category);

  useBrowserFocusRoute(props.active, (key, direction) => {
    if (direction === 'ArrowDown' && genreKeys.includes(key)) return sortEntry;

    if (direction === 'ArrowUp' && sortKeys.includes(key)) return genreEntry;
  });

  return (
    <View
      style={s.fill}
      onLayout={event => {
        const measured = event.nativeEvent.layout.width;

        if (measured > 0) setFilterWidth(measured);
      }}
    >
      <FocusScope
        id="catalogue-navigation"
        layout="column"
        boundary="parent"
        style={s.fill}
      >
        {Platform.OS === 'web' ? (
          <FocusVirtualizedRails
            id="01-genres"
            rails={genres}
            itemExtent={157 * u}
            viewportExtent={filterWidth || width - 192 * u}
            rowExtent={58 * u}
            horizontalAlignment="nearest"
          />
        ) : (
          <FocusScope
            id="01-genres"
            layout="row"
            boundary="parent"
            restoreOnEntry
            preferredKey={genreEntry}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.discoveryRail}
            >
              {genres[0].items.map((item, index) => (
                <Action
                  key={item.occurrenceKey}
                  id={item.occurrenceKey}
                  order={index}
                  label={item.accessibilityLabel}
                  displayLabel={item.displayLabel}
                  style={s.genreFilter}
                  onPress={item.onPress}
                />
              ))}
            </ScrollView>
          </FocusScope>
        )}
        <FocusScope
          id="02-sort"
          layout="row"
          boundary="parent"
          restoreOnEntry
          preferredKey={sortEntry}
          style={[s.catalogueFilters, s.sortRow]}
        >
          {sorts.map(([value, name, widthUnits], order) => (
            <Action
              key={value}
              order={order}
              id={occurrenceKey(id, 'sort', value)}
              label={name + (sort === value ? ', selected' : '')}
              highContrast={props.highContrast}
              quiet
              style={[s.textSort, { width: widthUnits * u }]}
              onPress={() => setSort(value)}
            >
              <View style={s.sortTextContent}>
                <Text
                  numberOfLines={1}
                  style={[s.sortLabel, sort === value && s.sortLabelSelected]}
                >
                  {name}
                </Text>
              </View>
            </Action>
          ))}
        </FocusScope>
        <Browse
          key={category + sort}
          {...props}
          onReady={reportReady}
          id={`${props.id}:${category}${sort === 'popular' ? '' : `:${sort}`}`}
          category={category}
          sort={sort}
          sortNavigation={{ keys: sortKeys, entry: sortEntry }}
          grid
        />
      </FocusScope>
    </View>
  );
}
