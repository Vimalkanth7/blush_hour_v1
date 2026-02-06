import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Redirect } from 'expo-router';

export default function Index() {
    const { isLoading, user } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
                <ActivityIndicator size="large" color="#FFD700" />
            </View>
        );
    }

    if (user && user.onboarding_completed) {
        return <Redirect href="/(tabs)/discovery" />;
    } else if (user && !user.onboarding_completed) {
        return <Redirect href="/(onboarding)/name" />;
    }

    return <Redirect href="/welcome" />;
}
