import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Image, TouchableOpacity, Text } from 'react-native';
// import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
// import Animated, { ... } from 'react-native-reanimated'; 
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Keep RootView if needed for other components? actually PhotoGrid uses it.
// Wait, PhotoGrid uses `GestureHandlerRootView`. So keep line 3 partially.
// But lines 4-9 must go.
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SPACING = 10;
const COLUMNS = 3;
const TILE_WIDTH = (SCREEN_WIDTH - SPACING * (COLUMNS + 1)) / COLUMNS;
const TILE_ASPECT_RATIO = 1.2; // Taller than wide
const TILE_HEIGHT = TILE_WIDTH * TILE_ASPECT_RATIO;

// Reanimated removed to fix crash
// import Animated, { ... } from 'react-native-reanimated'; 

interface PhotoGridProps {
    photos: (string | null)[];
    onPhotosChange: (photos: (string | null)[]) => void;
    onAddPhoto: (index: number) => void;
    onRemovePhoto: (index: number) => void;
}

const PhotoTile = ({
    url,
    index,
    onDragEnd,
    onAdd,
    onRemove
}: {
    url: string | null;
    index: number;
    onDragEnd: (from: number, to: number) => void;
    onAdd: () => void;
    onRemove: () => void;
}) => {
    // Reanimated hooks removed
    const initialPos = { x: 0, y: 0 }; // Placeholder if needed

    const style = {
        transform: [{ scale: 1 }],
        zIndex: 1,
    };

    return (
        <View style={[styles.tileContainer, style]}>
            {url ? (
                <>
                    <Image source={{ uri: url }} style={styles.image} />
                    <TouchableOpacity style={styles.deleteButton} onPress={onRemove}>
                        <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                </>
            ) : (
                <TouchableOpacity style={styles.emptyTile} onPress={onAdd}>
                    <Ionicons name="add" size={30} color="#ccc" />
                </TouchableOpacity>
            )}
        </View>
    );
};

export const PhotoGrid = ({ photos, onPhotosChange, onAddPhoto, onRemovePhoto }: PhotoGridProps) => {
    const handleDragEnd = (from: number, to: number) => {
        const newPhotos = [...photos];
        const item = newPhotos[from];
        newPhotos.splice(from, 1);
        newPhotos.splice(to, 0, item);
        // Ensure array stays at size 6
        const filledPhotos = newPhotos.slice(0, 6);
        while (filledPhotos.length < 6) filledPhotos.push(null);
        onPhotosChange(filledPhotos);
    };

    return (
        <GestureHandlerRootView style={styles.container}>
            <View style={styles.grid}>
                {photos.map((url, index) => (
                    <View key={index} style={styles.tileWrapper}>
                        <PhotoTile
                            url={url}
                            index={index}
                            onDragEnd={handleDragEnd}
                            onAdd={() => onAddPhoto(index)}
                            onRemove={() => onRemovePhoto(index)}
                        />
                    </View>
                ))}
            </View>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        height: (TILE_HEIGHT + SPACING) * 2,
        width: '100%',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tileWrapper: {
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
        marginRight: SPACING,
        marginBottom: SPACING,
    },
    tileContainer: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    emptyTile: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e0e0e0',
        borderStyle: 'dashed',
        borderRadius: 10,
    },
    deleteButton: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 4,
    }
});
