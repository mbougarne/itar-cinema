import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import {
  FocusScope,
  occurrenceKey,
  useFocusCommands,
  useFocusState,
} from '@bougarnem/itar/react';
import { captionAccessible } from './tv-accessibility';
import Browse from './Browse';
import { Action } from './components/Action';
import { Header } from './components/Header';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import type { ProviderMode } from './catalog-types';
import type { Film } from './catalog-types';

const letters = ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ'];
const arabicLetters = ['ابتثجحخ', 'دذرزسشص', 'ضطظعغفق', 'كلمنهوي', 'أةإآؤئى'];

export default function Search({
  id,
  active,
  delay,
  failNext,
  highContrast,
  onOpen,
  mode,
  onReady,
}: {
  onReady?: (initialKey?: string) => void;
  mode: ProviderMode;
  id: string;
  active: boolean;
  delay: number;
  failNext: () => boolean;
  highContrast: boolean;
  onOpen: (film: Film, openerKey: string) => void;
}) {
  const { t, rtl } = useCinemaLanguage();
  const { s } = useDesign();
  const keyboard = rtl ? arabicLetters : letters;
  const firstKey = keyboard[0][0];
  const [resultsWidth, setResultsWidth] = useState(0);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const awaitingQuery = text !== query;
  const commands = useFocusCommands();
  const focus = useFocusState();

  const edit = (source: string, next: string) => {
    setText(next);

    if (
      Platform.OS === 'web' &&
      active &&
      !next &&
      focus.kind === 'managed' &&
      focus.occurrenceKey === source
    ) {
      // The web command waits for the edit commit before resolving its target.
      commands.focusByKey(occurrenceKey(id, 'key', firstKey));
    }
  };

  const reportReady = useCallback(
    () => onReady?.(occurrenceKey(id, 'key', firstKey)),
    [firstKey, id, onReady],
  );

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 250);

    return () => clearTimeout(timer);
  }, [text]);

  return (
    <View style={s.search}>
      <View style={s.keyboardPanel}>
        <View style={s.query}>
          <Text
            accessible={captionAccessible}
            style={s.queryText}
            numberOfLines={2}
          >
            {text || t('Choose letters below')}
          </Text>
        </View>
        <FocusScope
          id="keyboard"
          restoreOnEntry={Platform.OS === 'ios' && Platform.isTV}
          layout="spatial"
          boundary="parent"
          style={s.keyboard}
        >
          {keyboard.map((row, index) => (
            <FocusScope
              key={row}
              id={`keys-${index}`}
              layout="row"
              boundary="parent"
              style={s.keyboardRow}
            >
              {Array.from(row).map((letter, order) => (
                <Action
                  order={order}
                  key={letter}
                  id={occurrenceKey(id, 'key', letter)}
                  label={letter}
                  tvDescription={
                    letter === firstKey
                      ? text
                        ? t('Search: {query}', { query: text })
                        : 'Search. Choose letters with your remote.'
                      : undefined
                  }
                  style={s.key}
                  onPress={() =>
                    setText(value => (value + letter).slice(0, 36))
                  }
                  highContrast={highContrast}
                />
              ))}
            </FocusScope>
          ))}
          <FocusScope
            id="editing"
            layout="row"
            boundary="parent"
            style={s.keyboardRow}
          >
            <Action
              order={0}
              id={occurrenceKey(id, 'space')}
              label="Space"
              tvDescription={
                text
                  ? `${t('Current query: {query}.', { query: text })} ${
                      text.length === 36 ? t('Maximum length reached.') : ''
                    }`
                  : 'Choose letters to search for a title or genre.'
              }
              style={s.editAction}
              onPress={() => setText(value => (value + ' ').slice(0, 36))}
              highContrast={highContrast}
            />
            <Action
              order={1}
              id={occurrenceKey(id, 'delete')}
              label="Delete"
              style={s.editAction}
              enabled={!!text}
              onPress={() =>
                edit(
                  occurrenceKey(id, 'delete'),
                  Array.from(text).slice(0, -1).join(''),
                )
              }
              highContrast={highContrast}
            />
            <Action
              order={2}
              id={occurrenceKey(id, 'clear')}
              label="Clear"
              style={s.editAction}
              enabled={!!text}
              onPress={() => edit(occurrenceKey(id, 'clear'), '')}
              highContrast={highContrast}
            />
          </FocusScope>
        </FocusScope>
        <Text accessible={captionAccessible} style={s.footer}>
          {text.length === 36
            ? t('Maximum query length reached (36 characters).')
            : t('Choose letters with your remote.')}
        </Text>
      </View>
      <View
        style={s.searchResults}
        onLayout={event => setResultsWidth(event.nativeEvent.layout.width)}
      >
        <Header>
          {awaitingQuery
            ? t('Updating results…')
            : query.trim()
            ? `${t('Results for')} “${query}”`
            : 'Suggested titles · Discover something new'}
        </Header>
        <Browse
          onReady={reportReady}
          viewportWidth={resultsWidth}
          mode={mode}
          id={id}
          kind="all"
          query={query}
          active={active && !awaitingQuery}
          delay={delay}
          failNext={failNext}
          highContrast={highContrast}
          onOpen={onOpen}
          searchResults
        />
      </View>
    </View>
  );
}
