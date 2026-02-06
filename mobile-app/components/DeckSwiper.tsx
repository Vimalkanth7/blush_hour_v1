import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { SwipeCard } from './SwipeCard';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

interface DeckSwiperProps {
    data: any[];
    onLike?: (user: any) => void;
    onPass?: (user: any) => void;
    onTap?: (user: any) => void;
}

export const DeckSwiper = ({ data, onLike, onPass, onTap }: DeckSwiperProps) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    const currentUser = data[currentIndex];
    const nextUser = data[currentIndex + 1];

    const handleNext = () => {
        // Safe index update
        if (currentIndex < data.length) {
            setCurrentIndex((prev) => prev + 1);
        }
        translateX.value = 0;
        translateY.value = 0;
    };

    const handleSwipeComplete = (direction: 'left' | 'right') => {
        if (direction === 'right') {
            onLike?.(currentUser);
        } else {
            onPass?.(currentUser);
        }
        handleNext();
    };

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY;
        })
        .onEnd((event) => {
            if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
                // Swipe Out
                const direction = event.translationX > 0 ? 'right' : 'left';
                translateX.value = withSpring(Math.sign(event.translationX) * width * 1.5, {}, () => {
                    runOnJS(handleSwipeComplete)(direction);
                });
            } else {
                // Spring Back
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
            }
        });

    const cardStyle = useAnimatedStyle(() => {
        const rotate = interpolate(
            translateX.value,
            [-width / 2, 0, width / 2],
            [-10, 0, 10],
            Extrapolate.CLAMP
        );

        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotate: `${rotate}deg` },
            ],
        };
    });

    const nextCardStyle = useAnimatedStyle(() => {
        const scale = interpolate(
            Math.abs(translateX.value),
            [0, width],
            [0.9, 1],
            Extrapolate.CLAMP
        );

        return {
            transform: [{ scale }],
        };
    });

    if (!currentUser) {
        return (
            <View style={styles.emptyContainer}>
                <Text>No more profiles!</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Background Card (Next) */}
            {nextUser && (
                <Animated.View style={[styles.cardWrapper, styles.nextCard, nextCardStyle]}>
                    <SwipeCard user={nextUser} />
                </Animated.View>
            )}

            {/* Top Card (Current) */}
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.cardWrapper, cardStyle]}>
                    <SwipeCard user={currentUser} onTap={() => onTap?.(currentUser)} />
                </Animated.View>
            </GestureDetector>

            {/* Floating Action Buttons Implementation */}
            <View style={styles.fabContainer}>
                <TouchableOpacity onPress={() => { onPass?.(currentUser); handleNext(); }} activeOpacity={0.7}>
                    <View style={[styles.fab, styles.passFab]}>
                        <Ionicons name="close" size={30} color="#ff4458" />
                    </View>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7}>
                    <View style={[styles.fab, styles.superFab]}>
                        <Ionicons name="star" size={24} color="#3b82f6" />
                    </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onLike?.(currentUser); handleNext(); }} activeOpacity={0.7}>
                    <View style={[styles.fab, styles.likeFab]}>
                        <Ionicons name="heart" size={30} color="#10b981" />
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f4f4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardWrapper: {
        position: 'absolute',
        width: width,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextCard: {
        zIndex: -1,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 40,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        width: '80%',
        zIndex: 100,
    },
    fab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    passFab: {
        borderWidth: 1,
        borderColor: '#ff4458',
    },
    likeFab: {
        borderWidth: 1,
        borderColor: '#10b981',
    },
    superFab: {
        width: 45,
        height: 45,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#3b82f6',
        marginTop: 10,
    }
});
