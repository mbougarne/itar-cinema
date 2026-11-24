import React, { useCallback, useMemo, useState } from 'react';
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
} from '@bougarnem/itar/react';
import Browse from './Browse';
import type { BrowseProps } from './browse-types';
import { categories, type Category, type CatalogueSort } from './catalog-types';
import { Action } from './components/Action';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';

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

  return (
    <View
      style={s.fill}
      onLayout={event => {
        const measured = event.nativeEvent.layout.width;

        if (measured > 0) setFilterWidth(measured);
      }}
    >
      {Platform.OS === 'web' ? (
        <FocusVirtualizedRails
          id="categories"
          rails={genres}
          itemExtent={157 * u}
          viewportExtent={filterWidth || width - 192 * u}
          rowExtent={58 * u}
          horizontalAlignment="nearest"
        />
      ) : (
        <FocusScope id="categories" layout="row" boundary="parent">
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
        id="catalogue-sort"
        layout="row"
        boundary="parent"
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
        grid
      />
    </View>
  );
}
