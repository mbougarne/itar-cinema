import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  FocusScope,
  occurrenceKey,
  useFocusCommands,
  useScreenReaderEnabled,
} from '@bougarnem/itar/react';
import { Picture } from './components/Picture';
import { Action } from './components/Action';
import { profileAvatars } from './artwork';
import {
  defaultProfiles,
  languages,
  type CinemaProfile,
  type ProfileLanguage,
} from './cinema-profiles';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';

const appleTV = Platform.OS === 'ios' && Platform.isTV;

export function Profiles({
  id,
  profile,
  profiles = defaultProfiles,
  onSelect,
  onBack,
  onSave,
  highContrast,
}: {
  id: string;
  profile: string;
  profiles?: readonly CinemaProfile[];
  onSelect: (name: string) => void;
  onBack?: () => void;
  onSave?: (profile: CinemaProfile) => Promise<void>;
  highContrast: boolean;
}) {
  const { t } = useCinemaLanguage();
  const { s, u } = useDesign();
  const commands = useFocusCommands();
  const reader = useScreenReaderEnabled();
  const [manage, setManage] = useState(false);
  const [draft, setDraft] = useState<CinemaProfile>();
  const [avatars, setAvatars] = useState(false);
  const [languageField, setLanguageField] = useState<'audio' | 'subtitles'>();
  const [nameEditing, setNameEditing] = useState(false);
  const [returnKey, setReturnKey] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameField = useRef<TextInput>(null);
  const key = useCallback((value: string) => occurrenceKey(id, value), [id]);
  const editing = !!draft;
  const existing = profiles.some(value => value.id === draft?.id);
  const saveKey = key('save');
  const avatarKey = key('avatar');
  const nameKey = key('name');

  const languageLabel =
    languageField === 'audio' ? 'Audio language' : 'Subtitles';

  const defaultLanguageLabel =
    languageField === 'audio' ? 'Original language' : 'Off';

  useEffect(() => {
    if (nameEditing) nameField.current?.focus();
  }, [nameEditing]);

  const initial = avatars
    ? key(`avatar-${draft?.avatar ?? 0}`)
    : languageField
    ? key(`language-${draft?.[languageField] ?? 'default'}`)
    : editing
    ? returnKey ?? nameKey
    : returnKey;

  useLayoutEffect(() => {
    if (!initial || reader || nameEditing) return;

    const request = commands.focusByKey(initial);

    return () => request.cancel();
  }, [commands, initial, reader, nameEditing]);

  useEffect(() => {
    if (!editing && !manage && !avatars) return;

    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving) return true;

      if (nameEditing) {
        setNameEditing(false);
        setReturnKey(nameKey);
      } else if (languageField) {
        setReturnKey(key(languageField));
        setLanguageField(undefined);
      } else if (avatars) {
        setAvatars(false);
        setReturnKey(avatarKey);
      } else if (draft) {
        setReturnKey(key(existing ? draft.id : 'create'));
        setDraft(undefined);
        setError('');
      } else {
        setManage(false);
        setReturnKey(key('manage'));
      }

      return true;
    });

    return () => listener.remove();
  }, [
    key,
    editing,
    manage,
    avatars,
    draft,
    saving,
    existing,
    avatarKey,
    languageField,
    nameEditing,
    nameKey,
  ]);

  const select = (entry: CinemaProfile) => {
    if (manage) {
      setReturnKey(undefined);
      setDraft(entry);
      setError('');
    } else onSelect(entry.id);
  };

  if (draft && languageField) {
    const options = [
      undefined,
      ...(Object.keys(languages) as ProfileLanguage[]),
    ];

    return (
      <FocusScope
        id="profile-language"
        layout="column"
        preferredKey={initial}
        style={s.profilePage}
      >
        <Text accessibilityRole="header" style={s.settingsHeading}>
          {languageLabel}
        </Text>
        {options.map((value, order) => {
          const label = value ? languages[value] : defaultLanguageLabel;

          return (
            <Action
              key={value ?? 'default'}
              id={key(`language-${value ?? 'default'}`)}
              order={order}
              label={label}
              displayLabel={
                draft[languageField] === value ? '✓  ' + label : label
              }
              quiet
              style={s.profileField}
              onPress={() => {
                setDraft({ ...draft, [languageField]: value });
                setReturnKey(key(languageField));
                setLanguageField(undefined);
              }}
            />
          );
        })}
      </FocusScope>
    );
  }

  if (draft) {
    const save = async () => {
      if (!onSave || saving || !draft.name.trim()) return;

      setSaving(true);
      setError('');

      try {
        await onSave({ ...draft, name: draft.name.trim() });
        setReturnKey(key(draft.id));
        setDraft(undefined);
      } catch {
        setError('This profile could not be saved. Try again.');
      } finally {
        setSaving(false);
      }
    };

    return (
      <FocusScope
        id={avatars ? 'avatars' : 'profile-edit'}
        accessibilityPaneTitle={avatars ? 'Choose an avatar' : 'Edit profile'}
        preferredKey={initial}
        style={[s.profilePage, s.editProfilePage]}
      >
        <Text accessibilityRole="header" style={s.settingsHeading}>
          {avatars
            ? 'Choose an avatar'
            : existing
            ? 'Edit profile'
            : 'Create a profile'}
        </Text>
        <View style={s.profileEditor}>
          <FocusScope
            id="profile-avatar"
            layout="column"
            boundary="parent"
            style={s.profileAvatarSide}
          >
            <Picture
              source={profileAvatars[draft.avatar]}
              style={s.profilePicture}
              fallback="Avatar unavailable"
            />
            {!avatars && (
              <Action
                id={avatarKey}
                label="Change avatar"
                quiet
                style={s.profileField}
                onPress={() => {
                  setAvatars(true);
                  setReturnKey(undefined);
                }}
              />
            )}
          </FocusScope>
          {avatars ? (
            <FocusScope
              id="avatar-list"
              layout="row"
              boundary="parent"
              style={s.avatarChoices}
            >
              {profileAvatars.map((source, index) => (
                <Action
                  key={index}
                  id={key(`avatar-${index}`)}
                  order={index}
                  label={`Avatar ${index + 1}${
                    index === draft.avatar ? ', selected' : ''
                  }`}
                  style={s.avatarChoice}
                  onPress={() => {
                    setDraft({ ...draft, avatar: index });
                    setAvatars(false);
                    setReturnKey(avatarKey);
                  }}
                >
                  <Picture
                    source={source}
                    style={{
                      width: 104 * u,
                      height: 104 * u,
                      borderRadius: 8 * u,
                    }}
                    fallback="Avatar unavailable"
                  />
                </Action>
              ))}
            </FocusScope>
          ) : (
            <FocusScope
              id="profile-fields"
              layout="column"
              boundary="parent"
              style={s.profileFields}
            >
              <View>
                <Text style={s.muted}>{t('Profile name')}</Text>
                {nameEditing ? (
                  <TextInput
                    ref={nameField}
                    accessibilityLabel="Profile name"
                    style={[s.authInput, s.profileField]}
                    value={draft.name}
                    maxLength={22}
                    returnKeyType="done"
                    submitBehavior="blurAndSubmit"
                    onChangeText={name => setDraft({ ...draft, name })}
                    onBlur={() => {
                      setReturnKey(nameKey);
                      setNameEditing(false);
                    }}
                  />
                ) : (
                  <Action
                    id={nameKey}
                    label="Profile name"
                    tvDescription={draft.name || undefined}
                    displayLabel={draft.name || 'Enter a name'}
                    style={[s.authInput, s.profileField]}
                    onPress={() => setNameEditing(true)}
                  />
                )}
              </View>
              {(['audio', 'subtitles'] as const).map((field, index) => {
                const preferred = draft[field];

                const label =
                  field === 'audio' ? 'Audio language' : 'Subtitles';

                const display = preferred
                  ? languages[preferred]
                  : field === 'audio'
                  ? 'Original language'
                  : 'Off';

                return (
                  <Action
                    key={field}
                    id={key(field)}
                    order={index + 1}
                    label={label}
                    tvDescription={display}
                    style={s.profileField}
                    onPress={() => setLanguageField(field)}
                  >
                    <View style={s.profileSetting}>
                      <Text style={s.body}>{t(label)}</Text>
                      <Text style={s.muted}>{t(display)} ›</Text>
                    </View>
                  </Action>
                );
              })}
              <Action
                id={key('autoplay')}
                order={3}
                label="Autoplay next episode"
                checked={draft.autoNext}
                style={s.profileField}
                onPress={() =>
                  setDraft({ ...draft, autoNext: !draft.autoNext })
                }
              >
                <View style={s.profileSetting}>
                  <Text style={s.body}>{t('Autoplay next episode')}</Text>
                  <View
                    style={[s.switchTrack, draft.autoNext && s.switchTrackOn]}
                  >
                    <View style={s.switchThumb} />
                  </View>
                </View>
              </Action>
              <Action
                id={saveKey}
                order={4}
                label={saving ? 'Saving profile' : 'Save profile'}
                enabled={!!draft.name.trim() && !saving}
                onPress={save}
                primary
                style={[s.primaryCta, s.profileField]}
                highContrast={highContrast}
              />
              <Action
                id={key('cancel-edit')}
                order={5}
                label="Cancel"
                enabled={!saving}
                quiet
                style={s.profileField}
                onPress={() => {
                  setReturnKey(key(existing ? draft.id : 'create'));
                  setDraft(undefined);
                  setError('');
                }}
              />
              {!!error && (
                <Text accessibilityLiveRegion="polite" style={s.muted}>
                  {error}
                </Text>
              )}
            </FocusScope>
          )}
        </View>
      </FocusScope>
    );
  }

  return (
    <FocusScope
      id="profile-list"
      accessibilityPaneTitle={manage ? 'Edit profiles' : 'Who’s watching?'}
      preferredKey={returnKey}
      style={s.profilePage}
    >
      <View style={s.accountHeader}>
        <Text accessible={false} style={s.accountWordmark}>
          {t('▶ ITAR CINEMA')}
        </Text>
        {onBack && (
          <Action
            id={key('back-to-cinema')}
            label="Back"
            displayLabel="←  Back"
            onPress={onBack}
            style={s.accountBack}
          />
        )}
      </View>
      <Text
        accessibilityRole="header"
        accessible={appleTV ? false : undefined}
        style={s.chooserTitle}
      >
        {manage ? 'Edit profiles' : 'Who’s watching?'}
      </Text>
      <Text
        accessible={appleTV ? false : undefined}
        style={[s.subtitle, s.centered]}
      >
        {t('Pick a profile to keep your watch history and My List together.')}
      </Text>
      <FocusScope id="choices" layout="row" boundary="parent">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.profileScroll}
          contentContainerStyle={s.profiles}
        >
          {profiles.map((entry, index) => (
            <Action
              key={entry.id}
              id={key(entry.id)}
              order={index}
              label={
                manage
                  ? t('Edit {name}', { name: entry.name })
                  : entry.id === profile
                  ? t('{name}, current profile', { name: entry.name })
                  : entry.name
              }
              tvDescription={
                entry.id === profile
                  ? 'Choose a profile for your saved titles and watch history.'
                  : undefined
              }
              onPress={() => select(entry)}
              style={s.profileTile}
              highContrast={highContrast}
            >
              <View style={s.profileTileCopy}>
                <Picture
                  source={profileAvatars[entry.avatar]}
                  style={s.profilePicture}
                  fallback="Profile artwork unavailable"
                />
                <Text
                  accessible={false}
                  numberOfLines={1}
                  style={s.detailCardCaption}
                >
                  {entry.name}
                </Text>
                {entry.id === profile && (
                  <Text accessible={false} style={s.muted}>
                    {t('Current profile')}
                  </Text>
                )}
              </View>
            </Action>
          ))}
          {onSave && (
            <Action
              order={profiles.length}
              id={key('create')}
              label="Create profile"
              style={s.profileTile}
              highContrast={highContrast}
              onPress={() => {
                setReturnKey(undefined);

                setDraft({
                  id: `profile-${Date.now().toString(36)}`,
                  name: '',
                  avatar: 0,
                  autoNext: false,
                });

                setError('');
              }}
            >
              <View style={s.profileTileCopy}>
                <View style={[s.profilePicture, s.createProfilePicture]}>
                  <Text style={s.profilePlus}>＋</Text>
                </View>
                <Text style={s.detailCardCaption}>{t('Create profile')}</Text>
              </View>
            </Action>
          )}
        </ScrollView>
      </FocusScope>
      {onSave && (
        <Action
          id={key('manage')}
          label={t(manage ? 'Done' : 'Edit profiles')}
          onPress={() => {
            setManage(!manage);
            setReturnKey(key(profile));
          }}
        />
      )}
    </FocusScope>
  );
}
