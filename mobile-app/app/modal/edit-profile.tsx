import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useState } from 'react';
import { View, ScrollView, Text, TextInput, Dimensions, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PhotoGrid } from '../../components/PhotoGrid';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../../constants/Api';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const LANGUAGE_OPTIONS = [
    'English',
    'Hindi',
    'Tamil',
    'Telugu',
    'Kannada',
    'Malayalam',
    'Marathi',
    'Bengali',
    'Gujarati',
    'Punjabi',
    'Urdu'
];

const HABIT_OPTIONS = {
    drinking: ['No', 'Occasionally', 'Yes'],
    smoking: ['No', 'Occasionally', 'Yes'],
    exercise: ['Never', 'Sometimes', 'Often'],
    kids: ['No', 'Want someday', 'Have kids']
};

export default function EditProfileScreen() {
    const router = useRouter();
    const { initialSection } = useLocalSearchParams();
    const { user, token, refreshProfile } = useAuth();

    // --- State Initialization ---
    // 1. Photos
    const [photos, setPhotos] = useState<(string | null)[]>(
        user?.photos ? [...user.photos, ...Array(6 - user.photos.length).fill(null)].slice(0, 6)
            : [null, null, null, null, null, null]
    );

    // 2. Bio
    const [bio, setBio] = useState(user?.bio || '');

    // 3. Basics
    const [work, setWork] = useState(user?.work || '');
    const [education, setEducation] = useState(user?.education || '');
    const [hometown, setHometown] = useState(user?.hometown || '');
    const [location, setLocation] = useState(user?.location || '');

    // 4. Details (More About You)
    const [height, setHeight] = useState(user?.height || '');
    const [exercise, setExercise] = useState(user?.habits?.exercise || '');
    const [drinking, setDrinking] = useState(user?.habits?.drinking || '');
    const [smoking, setSmoking] = useState(user?.habits?.smoking || '');
    const [kids, setKids] = useState(user?.habits?.kids || '');
    const [educationLevel, setEducationLevel] = useState(user?.education_level || '');
    const [datingPreference, setDatingPreference] = useState(user?.dating_preference || '');
    const [kidsHave, setKidsHave] = useState(user?.kids_have || '');
    const [kidsWant, setKidsWant] = useState(user?.kids_want || '');
    const [starSign, setStarSign] = useState(user?.star_sign || '');
    const [politics, setPolitics] = useState(user?.politics || '');
    const [religion, setReligion] = useState(user?.religion || '');

    // 5. Interests & Values (Comma separated for MVP editing)
    const [interests, setInterests] = useState(user?.interests?.join(', ') || '');
    const [values, setValues] = useState(user?.values?.join(', ') || '');
    const [causes, setCauses] = useState(user?.causes?.join(', ') || '');
    const [languages, setLanguages] = useState<string[]>(user?.languages ?? []);

    // 6. Prompts (Array of {question, answer})
    const [prompts, setPrompts] = useState<{ question: string, answer: string }[]>(
        user?.prompts?.length ? user.prompts : [{ question: "A valid excuse for being late...", answer: "" }]
    );

    const [isSaving, setIsSaving] = useState(false);

    // --- Scroll Logic ---
    const scrollViewRef = React.useRef<ScrollView>(null);
    const [sectionY, setSectionY] = useState<{ [key: string]: number }>({});

    // Scroll to section on mount if params exist
    React.useEffect(() => {
        if (initialSection && scrollViewRef.current && sectionY[initialSection as string]) {
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: sectionY[initialSection as string], animated: true });
            }, 500); // Slight delay for modal interaction
        }
    }, [initialSection, sectionY]);

    // --- Photo Logic ---
    const handleAddPhoto = async (index: number) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Denied", "We need access to photos.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.8,
        });

        if (!result.canceled && result.assets[0].uri) {
            const newPhotos = [...photos];
            newPhotos[index] = result.assets[0].uri;
            setPhotos(newPhotos);
        }
    };

    const handleRemovePhoto = (index: number) => {
        const newPhotos = [...photos];
        newPhotos[index] = null;
        setPhotos(newPhotos);
    };

    // --- Prompt Logic ---
    const handleAddPrompt = () => {
        setPrompts([...prompts, { question: "New Prompt", answer: "" }]);
    };

    const handleRemovePrompt = (index: number) => {
        const newP = [...prompts];
        newP.splice(index, 1);
        setPrompts(newP);
    };

    const handleUpdatePrompt = (index: number, field: 'question' | 'answer', text: string) => {
        const newP = [...prompts];
        newP[index] = { ...newP[index], [field]: text };
        setPrompts(newP);
    };

    const toggleLanguage = (language: string) => {
        setLanguages((prev) => {
            if (prev.includes(language)) {
                return prev.filter((item) => item !== language);
            }
            return [...prev, language];
        });
    };

    const buildHabitsPayload = () => {
        const payload: Record<string, string> = {};
        if (exercise) payload.exercise = exercise;
        if (drinking) payload.drinking = drinking;
        if (smoking) payload.smoking = smoking;
        if (kids) payload.kids = kids;
        return payload;
    };

    // --- Save Logic ---
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const habitsPayload = buildHabitsPayload();
            const body = {
                // Section 1
                photos: photos.filter(Boolean),
                // Section 2
                bio,
                // Section 3
                work,
                education,
                hometown,
                location,
                // Section 4
                height,
                habits: habitsPayload,
                education_level: educationLevel,
                dating_preference: datingPreference,
                kids_have: kidsHave,
                kids_want: kidsWant,
                star_sign: starSign,
                politics,
                religion,
                // Section 5 (Parse List)
                interests: interests.split(',').map(s => s.trim()).filter(Boolean),
                values: values.split(',').map(s => s.trim()).filter(Boolean),
                causes: causes.split(',').map(s => s.trim()).filter(Boolean),
                languages,
                // Section 6
                prompts: prompts.filter(p => p.answer.trim().length > 0)
            };

            const res = await fetch(`${API_BASE_URL}/api/users/me`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                await refreshProfile();
                router.back();
            } else {
                const txt = await res.text();
                console.warn("Save Error:", txt);
                Alert.alert("Error", "Failed to save profile.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Network error.");
        } finally {
            setIsSaving(false);
        }
    };

    const visibleLanguageOptions = React.useMemo(() => {
        const extraLanguages = languages.filter((language) => !LANGUAGE_OPTIONS.includes(language));
        return [...LANGUAGE_OPTIONS, ...extraLanguages];
    }, [languages]);

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator size="small" color={COLORS.primaryText} /> : <Text style={styles.doneText}>Done</Text>}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
            >
                <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.content}
                >
                    {/* Profile Strength Header */}
                    <View style={styles.strengthContainer}>
                        <View style={styles.strengthRow}>
                            <View style={[styles.strengthRing, { borderColor: getColorForCompletion(user?.profile_completion || 0) }]}>
                                <Text style={styles.strengthText}>{user?.profile_completion || 0}%</Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: SPACING.md }}>
                                <Text style={styles.strengthTitle}>Profile Strength</Text>
                                <Text style={styles.strengthSub}>Complete to get more matches</Text>
                            </View>
                            <Ionicons name="chevron-down" size={20} color={COLORS.secondaryText} />
                        </View>
                    </View>

                    {/* Section 1: Photos */}
                    <Text style={styles.sectionHeader}>PHOTOS</Text>
                    <View style={styles.photoSection}>
                        <Text style={styles.subsectionTitle}>Drag to reorder</Text>
                        <PhotoGrid
                            photos={photos}
                            onPhotosChange={setPhotos}
                            onAddPhoto={handleAddPhoto}
                            onRemovePhoto={handleRemovePhoto}
                        />
                        <View style={styles.mainLabelContainer}>
                            <Text style={styles.mainLabelText}>Main</Text>
                        </View>
                    </View>

                    {/* Section 2: Bio */}
                    <Text style={styles.sectionHeader}>BIO</Text>
                    <View style={styles.sectionContainer}>
                        <TextInput
                            style={styles.bioInput}
                            multiline
                            placeholder="About me..."
                            placeholderTextColor={COLORS.disabledText}
                            value={bio}
                            onChangeText={setBio}
                            maxLength={500}
                        />
                    </View>

                    {/* Section 3: About You */}
                    <Text style={styles.sectionHeader}>ABOUT YOU</Text>
                    <View style={styles.sectionContainer}>
                        <ProfileRow label="Work" value={work} onChange={setWork} placeholder="Add Job" />
                        <ProfileRow label="Education" value={education} onChange={setEducation} placeholder="Add School" />
                        <ProfileRow label="Gender" value={user?.gender || ''} editable={false} />
                        <ProfileRow label="Location" value={location} onChange={setLocation} placeholder="Add City" />
                        <ProfileRow label="Hometown" value={hometown} onChange={setHometown} placeholder="Add Hometown" last />
                    </View>

                    {/* Section 4: More Details */}
                    <Text style={styles.sectionHeader}>MORE ABOUT YOU</Text>
                    <View style={styles.sectionContainer}>
                        <ProfileRow label="Height" value={height} onChange={setHeight} placeholder="Add Height" />
                        <ProfileRow label="Education Level" value={educationLevel} onChange={setEducationLevel} placeholder="Add Degree" />
                        <ProfileRow label="Looking For" value={datingPreference} onChange={setDatingPreference} placeholder="Add Pref" />
                        <ProfileRow label="Kids (Have)" value={kidsHave} onChange={setKidsHave} placeholder="Add Status" />
                        <ProfileRow label="Kids (Want)" value={kidsWant} onChange={setKidsWant} placeholder="Add Status" />
                        <ProfileRow label="Star Sign" value={starSign} onChange={setStarSign} placeholder="Add Sign" />
                        <ProfileRow label="Politics" value={politics} onChange={setPolitics} placeholder="Add Views" />
                        <ProfileRow label="Religion" value={religion} onChange={setReligion} placeholder="Add Beliefs" last />
                    </View>

                    {/* Section 5: Languages */}
                    <Text style={styles.sectionHeader}>LANGUAGES</Text>
                    <View style={styles.sectionContainer}>
                        <View style={styles.chipWrap}>
                            {visibleLanguageOptions.map((language) => {
                                const selected = languages.includes(language);
                                return (
                                    <TouchableOpacity
                                        key={language}
                                        onPress={() => toggleLanguage(language)}
                                        style={[styles.chip, selected && styles.chipActive]}
                                    >
                                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{language}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                    <Text style={styles.helperText}>Tap to select multiple</Text>

                    {/* Section 6: Habits */}
                    <Text style={styles.sectionHeader}>HABITS</Text>
                    <View style={styles.sectionContainer}>
                        <HabitRow label="Drinking" value={drinking} options={HABIT_OPTIONS.drinking} onChange={setDrinking} />
                        <HabitRow label="Smoking" value={smoking} options={HABIT_OPTIONS.smoking} onChange={setSmoking} />
                        <HabitRow label="Exercise" value={exercise} options={HABIT_OPTIONS.exercise} onChange={setExercise} />
                        <HabitRow label="Kids" value={kids} options={HABIT_OPTIONS.kids} onChange={setKids} last />
                    </View>

                    {/* Section 7: Tags (Simplified) */}
                    <Text
                        style={styles.sectionHeader}
                        onLayout={(e) => setSectionY(prev => ({ ...prev, interests: e.nativeEvent.layout.y }))}
                    >
                        INTERESTS & VALUES
                    </Text>
                    <View style={styles.sectionContainer}>
                        <ProfileRow label="Interests" value={interests} onChange={setInterests} placeholder="e.g. Travel, Sushi" />
                        <ProfileRow label="Values" value={values} onChange={setValues} placeholder="e.g. Kindness" />
                        <ProfileRow label="Causes" value={causes} onChange={setCauses} placeholder="e.g. Environment" last />
                    </View>
                    <Text style={styles.helperText}>Separate with commas</Text>

                    {/* Section 8: Prompts */}
                    <Text
                        style={styles.sectionHeader}
                        onLayout={(e) => setSectionY(prev => ({ ...prev, prompts: e.nativeEvent.layout.y }))}
                    >
                        PROFILE PROMPTS
                    </Text>
                    {prompts.map((p, index) => (
                        <View key={index} style={[styles.sectionContainer, { marginBottom: SPACING.md }]}>
                            <View style={styles.promptRow}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={styles.promptLabel}>Prompt {index + 1}</Text>
                                    {prompts.length > 1 && (
                                        <TouchableOpacity onPress={() => handleRemovePrompt(index)}>
                                            <Ionicons name="trash-outline" size={16} color={COLORS.destructive} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <TextInput
                                    style={styles.promptInput}
                                    value={p.question}
                                    onChangeText={(text) => handleUpdatePrompt(index, 'question', text)}
                                    placeholder="e.g. A valid excuse for being late..."
                                    placeholderTextColor={COLORS.disabledText}
                                />
                            </View>
                            <View style={[styles.promptRow, { borderBottomWidth: 0 }]}>
                                <Text style={styles.promptLabel}>Answer</Text>
                                <TextInput
                                    style={[styles.promptInput, { color: COLORS.primaryText }]}
                                    value={p.answer}
                                    onChangeText={(text) => handleUpdatePrompt(index, 'answer', text)}
                                    multiline
                                    placeholder="Write your answer..."
                                    placeholderTextColor={COLORS.disabledText}
                                />
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity onPress={handleAddPrompt} style={{
                        alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surface,
                        borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brandBase,
                        marginHorizontal: SPACING.screen, borderStyle: 'dashed'
                    }}>
                        <Text style={{ color: COLORS.brandBase, fontWeight: '600' }}>+ Add Another Prompt</Text>
                    </TouchableOpacity>

                    <View style={{ height: 50 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

// Sub-component for Rows
const ProfileRow = ({ label, value, onChange, placeholder, editable = true, last }: any) => (
    <TouchableOpacity style={[styles.row, last && styles.lastRow]} activeOpacity={1}>
        <Text style={styles.label}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
            {editable ? (
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={COLORS.disabledText}
                    textAlign="right"
                />
            ) : (
                <Text style={[styles.input, { color: COLORS.disabledText }]}>{value}</Text>
            )}
            {editable && <Ionicons name="chevron-forward" size={18} color={COLORS.border} style={{ marginLeft: SPACING.sm }} />}
        </View>
    </TouchableOpacity>
);

const HabitRow = ({ label, value, options, onChange, last }: any) => (
    <View style={[styles.habitRow, last && styles.lastRow]}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.habitOptions}>
            {options.map((option: string) => {
                const selected = value === option;
                return (
                    <TouchableOpacity
                        key={option}
                        onPress={() => onChange(option)}
                        style={[styles.chip, selected && styles.chipActive]}
                    >
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>
);

const getColorForCompletion = (val: number) => {
    if (val < 50) return COLORS.destructive;
    if (val < 80) return COLORS.primary;
    return COLORS.success;
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 50, paddingHorizontal: SPACING.screen, paddingBottom: SPACING.md, backgroundColor: COLORS.background,
        borderBottomWidth: 1, borderBottomColor: COLORS.border, zIndex: 10
    },
    headerTitle: { ...TYPOGRAPHY.bodyLarge, fontWeight: '600', color: COLORS.primaryText },
    cancelText: { ...TYPOGRAPHY.bodyBase, color: COLORS.secondaryText },
    doneText: { ...TYPOGRAPHY.bodyBase, fontWeight: '600', color: COLORS.primary },
    content: { paddingBottom: 50 },

    strengthContainer: { backgroundColor: COLORS.background, padding: SPACING.screen, marginBottom: SPACING.md, borderBottomWidth: 1, borderColor: COLORS.border },
    strengthRow: { flexDirection: 'row', alignItems: 'center' },
    strengthRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
    strengthText: { fontSize: 12, fontWeight: '700', color: COLORS.primaryText },
    strengthTitle: { ...TYPOGRAPHY.h2, fontSize: 16, color: COLORS.primaryText },
    strengthSub: { ...TYPOGRAPHY.bodyBase, fontSize: 13, color: COLORS.secondaryText },

    sectionHeader: { fontSize: 13, fontWeight: '600', color: COLORS.secondaryText, marginLeft: SPACING.screen, marginTop: SPACING.xl, marginBottom: SPACING.sm, textTransform: 'uppercase' },
    subsectionTitle: { fontSize: 13, color: COLORS.disabledText, marginBottom: SPACING.sm },
    photoSection: { paddingHorizontal: SPACING.screen },
    mainLabelContainer: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm },
    mainLabelText: { color: 'white', fontSize: 10, fontWeight: '700' }, // Keep white for overlay label

    sectionContainer: { backgroundColor: COLORS.background, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },

    bioInput: { padding: SPACING.screen, fontSize: 16, minHeight: 100, textAlignVertical: 'top', color: COLORS.primaryText },

    row: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: SPACING.md, paddingHorizontal: SPACING.screen, marginLeft: SPACING.screen,
        borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingRight: 32
    },
    lastRow: { borderBottomWidth: 0 },

    label: { fontSize: 16, color: COLORS.primaryText },
    input: { flex: 1, fontSize: 16, color: COLORS.secondaryText, marginLeft: 10 },

    habitRow: {
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.screen,
        marginLeft: SPACING.screen,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border
    },
    habitOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING.sm },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: SPACING.screen },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 13, color: COLORS.secondaryText },
    chipTextActive: { color: COLORS.background, fontWeight: '600' },

    helperText: { marginLeft: SPACING.screen, marginTop: 6, fontSize: 12, color: COLORS.disabledText },

    promptRow: { padding: SPACING.screen, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    promptLabel: { fontSize: 12, color: COLORS.disabledText, marginBottom: 4, textTransform: 'uppercase' },
    promptInput: { fontSize: 16, color: COLORS.primaryText }
});
