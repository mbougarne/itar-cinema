import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Platform,
  Text,
  TextInput,
  TouchableNativeFeedback,
  View,
} from 'react-native';
import {
  FocusScope,
  occurrenceKey,
  useFocusCommands,
  useFocusReady,
  useScreenReaderEnabled,
} from '@bougarnem/itar/react';
import { captionAccessible } from './tv-accessibility';
import { BrowserNavigation } from './browser-navigation';
import { Action } from './components/Action';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { useAppleTVMenu } from './useAppleTVMenu';

export default function Auth({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useCinemaLanguage();
  const { s, u } = useDesign();
  const [form, setForm] = useState<'Sign in' | 'Sign up' | null>(null);
  const [focusedFormAction, setFocusedFormAction] = useState<string>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editing, setEditing] = useState<'email' | 'password' | null>(null);
  const returnTarget = useRef<'email' | 'password' | 'submit'>('email');
  const browserNavigation = useContext(BrowserNavigation);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const commands = useFocusCommands();
  const ready = useFocusReady();
  const reader = useScreenReaderEnabled();

  const readerLayout =
    Platform.OS === 'ios' && Platform.isTV && reader === true;

  useAppleTVMenu(!!form);

  useEffect(() => {
    if (
      !ready ||
      editing ||
      readerLayout ||
      (Platform.OS === 'android' && form)
    ) {
      return;
    }

    const request = commands.focusByKey(
      occurrenceKey('auth', form ? returnTarget.current : 'signin'),
    );

    return () => request.cancel();
  }, [commands, ready, form, editing, readerLayout]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      return;
    }

    const listener = Keyboard.addListener('keyboardDidHide', () =>
      setEditing(null),
    );

    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (editing) {
      (editing === 'email' ? emailInput : passwordInput).current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editing) {
        setEditing(null);

        return true;
      }

      if (form) {
        setForm(null);

        return true;
      }

      return false;
    });

    return () => handler.remove();
  }, [form, editing]);

  function moveDownFromField(field: 'email' | 'password') {
    if (Platform.OS === 'web') {
      returnTarget.current = field === 'email' ? 'password' : 'submit';
    }

    setEditing(null);
  }

  function onEditorKey(
    field: 'email' | 'password',
    key: { key: string; isComposing?: boolean } & Partial<React.KeyboardEvent>,
  ) {
    if (
      key.repeat ||
      key.altKey ||
      key.ctrlKey ||
      key.metaKey ||
      key.shiftKey ||
      key.isComposing ||
      key.keyCode === 229
    )
      return;

    // The TV keyboard handles its own arrows. Only act on keys it delivers to the editor.
    if (key.keyCode === 65385) {
      setEditing(null); // Samsung IME Cancel
    } else if (key.keyCode === 65376) {
      setEditing(null); // Samsung IME Done returns to the edited field.
    } else if (browserNavigation?.enabled) {
      if (key.key === 'ArrowDown' || key.keyCode === 40) {
        moveDownFromField(field);
      } else if (
        field === 'password' &&
        (key.key === 'ArrowUp' || key.keyCode === 38)
      ) {
        returnTarget.current = 'email';
        setEditing(null);
      }
    }
  }

  function openForm(next: 'Sign in' | 'Sign up') {
    returnTarget.current = 'email';
    setForm(next);
  }

  return (
    <FocusScope
      id="welcome"
      layout="spatial"
      style={s.auth}
      accessibilityPaneTitle={
        readerLayout && !editing ? form || 'Itar Cinema' : undefined
      }
      preferredKey={
        readerLayout && !editing
          ? occurrenceKey('auth', form ? returnTarget.current : 'signin')
          : undefined
      }
    >
      <Text accessible={captionAccessible} style={s.splashBrand}>
        <Text accessible={captionAccessible} style={s.brandStrong}>
          ITAR
        </Text>{' '}
        CINEMA
      </Text>
      <Text accessible={captionAccessible} style={s.heroTitle}>
        {form || 'A world of stories.'}
      </Text>
      <Text accessible={captionAccessible} style={s.body}>
        {t(
          form
            ? 'Demo account · Any email and password will work.'
            : 'Find your next favourite. Explore films, series and what’s on TV.',
        )}
      </Text>
      {form ? (
        <>
          {(['email', 'password'] as const).map(field => (
            <View key={field}>
              <Text accessible={captionAccessible} style={s.muted}>
                {t(field === 'email' ? 'Email' : 'Password')}
              </Text>
              {Platform.OS === 'android' || editing === field ? (
                <TextInput
                  ref={field === 'email' ? emailInput : passwordInput}
                  style={s.authInput}
                  placeholder={t(
                    field === 'email'
                      ? 'Enter any email'
                      : 'Enter any password',
                  )}
                  accessibilityLabel={t(
                    field === 'email' ? 'Email' : 'Password',
                  )}
                  value={field === 'email' ? email : password}
                  onChangeText={field === 'email' ? setEmail : setPassword}
                  secureTextEntry={field === 'password'}
                  keyboardType={field === 'email' ? 'email-address' : 'default'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onKeyPress={
                    Platform.OS === 'web'
                      ? event => onEditorKey(field, event.nativeEvent)
                      : undefined
                  }
                  submitBehavior="blurAndSubmit"
                  maxLength={120}
                  onBlur={
                    Platform.OS === 'android'
                      ? undefined
                      : () => setEditing(null)
                  }
                  onSubmitEditing={
                    Platform.OS === 'android'
                      ? undefined
                      : () => setEditing(null)
                  }
                />
              ) : (
                <Action
                  id={occurrenceKey('auth', field)}
                  label={field === 'email' ? 'Edit email' : 'Edit password'}
                  tvDescription={
                    field === 'email'
                      ? 'Demo account. Any email and password will work.'
                      : undefined
                  }
                  displayLabel={
                    field === 'email'
                      ? email || 'Enter any email'
                      : password
                      ? '••••••••'
                      : 'Enter any password'
                  }
                  onPress={() => {
                    returnTarget.current = field;
                    setEditing(field);
                  }}
                  style={s.authInput}
                />
              )}
            </View>
          ))}
          {Platform.OS === 'android' ? (
            // Keep the whole form native so directional input can return from
            // its buttons to the unmanaged editors without an engine handoff.
            <View style={s.row}>
              {[
                { label: form, width: 640, onPress: onSignIn },
                { label: 'Back', width: 250, onPress: () => setForm(null) },
              ].map(action => (
                <TouchableNativeFeedback
                  key={action.label}
                  useForeground
                  background={TouchableNativeFeedback.Ripple(
                    'rgba(255,255,255,0.5)',
                    false,
                  )}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  accessibilityActions={[{ name: 'activate' }]}
                  onAccessibilityAction={({ nativeEvent }) => {
                    if (nativeEvent.actionName === 'activate') action.onPress();
                  }}
                  onPress={action.onPress}
                >
                  <View
                    onFocus={() => setFocusedFormAction(action.label)}
                    onBlur={() =>
                      setFocusedFormAction(current =>
                        current === action.label ? undefined : current,
                      )
                    }
                    style={[
                      s.primaryCta,
                      s.feedback,
                      { width: action.width * u },
                      focusedFormAction === action.label && s.focusedNativeCta,
                    ]}
                  >
                    <Text
                      accessible={captionAccessible}
                      style={[
                        s.body,
                        s.centered,
                        s.primaryCtaText,
                        focusedFormAction === action.label &&
                          s.focusedPrimaryCtaText,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </View>
                </TouchableNativeFeedback>
              ))}
            </View>
          ) : (
            <FocusScope
              id="auth-actions"
              layout="row"
              boundary="parent"
              style={s.row}
            >
              <Action
                id={occurrenceKey('auth', 'submit')}
                label={t(form)}
                tvDescription="No account is created. Your entries stay on this device for this session."
                onPress={onSignIn}
                primary
                style={[s.primaryCta, { width: 640 * u }]}
              />
              <Action
                order={1}
                id={occurrenceKey('auth', 'back')}
                label="Back"
                onPress={() => setForm(null)}
              />
            </FocusScope>
          )}
          <Text accessible={captionAccessible} style={s.footer}>
            {t(
              'No account is created. These values stay in memory and are never sent or saved.',
            )}
          </Text>
        </>
      ) : (
        <FocusScope
          id="welcome-actions"
          layout="row"
          boundary="parent"
          style={s.heroActions}
        >
          <Action
            id={occurrenceKey('auth', 'signin')}
            label="Sign in"
            onPress={() => openForm('Sign in')}
            primary
            style={s.primaryCta}
          />
          <Action
            order={1}
            id={occurrenceKey('auth', 'signup')}
            label="Sign up"
            tvDescription="Itar Cinema demo account."
            onPress={() => openForm('Sign up')}
            primary
            style={s.primaryCta}
          />
        </FocusScope>
      )}
    </FocusScope>
  );
}
