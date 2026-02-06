import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';
// ... (logic)
export default function Name() {
    const router = useRouter();
    const { updateData } = useRegistration();
    const { signOut } = useAuth();
    const [name, setName] = useState('');

    const handleNext = () => {
        updateData({ firstName: name });
        router.push('/(onboarding)/birthday');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            signOut();
                        }
                    }}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
                </TouchableOpacity>
            </View>

            <Text style={styles.title}>What's your first name?</Text>

            <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor={COLORS.disabledText}
                autoFocus
                value={name}
                onChangeText={setName}
            />
            <Text style={styles.subtitle}>This is how it will appear in your profile.</Text>

            <TouchableOpacity
                style={[styles.nextButton, { opacity: name.length > 0 ? 1 : 0.5 }]}
                onPress={handleNext}
                disabled={name.length === 0}
            >
                <Ionicons name="arrow-forward" size={24} color={COLORS.brandBase} />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

// const router = useRouter();
// const { updateData } = useRegistration();
// const { signOut } = useAuth();
// const [name, setName] = useState('');

// const handleNext = () => {
//     updateData({ firstName: name });
//     router.push('/(onboarding)/birthday');
// };

// return (
//     <SafeAreaView style={styles.container}>
//         <View style={styles.header}>
//             <TouchableOpacity onPress={() => {
//                 if (router.canGoBack()) {
//                     router.back();
//                 } else {
//                     signOut();
//                 }
//             }}>
//                 <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
//             </TouchableOpacity>
//         </View>

//         <Text style={styles.title}>What's your first name?</Text>

//         <TextInput
//             style={styles.input}
//             placeholder="First Name"
//             placeholderTextColor={COLORS.disabledText}
//             autoFocus
//             value={name}
//             onChangeText={setName}
//         />
//         <Text style={styles.subtitle}>This is how it will appear in your profile.</Text>

//         <TouchableOpacity
//             style={[styles.nextButton, { opacity: name.length > 0 ? 1 : 0.5 }]}
//             onPress={handleNext}
//             disabled={name.length === 0}
//         >
//             <Ionicons name="arrow-forward" size={24} color={COLORS.brandBase} />
//         </TouchableOpacity>
//     </SafeAreaView>
// );
// }

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.screen
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.display
    },
    title: {
        ...TYPOGRAPHY.display,
        color: COLORS.primaryText,
        marginBottom: SPACING.xl
    },
    input: {
        fontSize: 24,
        fontWeight: '600',
        color: COLORS.primaryText,
        borderBottomWidth: 2,
        borderBottomColor: COLORS.primary,
        paddingBottom: SPACING.sm,
        width: '100%',
        fontFamily: TYPOGRAPHY.fontFamily
    },
    subtitle: {
        marginTop: SPACING.lg,
        color: COLORS.secondaryText,
        ...TYPOGRAPHY.bodyBase
    },
    nextButton: {
        position: 'absolute',
        bottom: 40, right: 24,
        width: 56, height: 56,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        ...SHADOWS.small
    }
});

