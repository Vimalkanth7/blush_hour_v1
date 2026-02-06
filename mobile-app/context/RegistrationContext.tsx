import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RegistrationData {
    // Auth
    phoneNumber: string;

    // Identity
    firstName: string;
    birthday: Date;
    gender: string;
    showGender: boolean;
    datingPreference: string; // Men, Women, Everyone

    // Mode & Intentions
    mode: 'Date' | 'BFF';
    intention: string;

    // Attributes
    height: string;
    exercise: string;
    education: string;
    drinking: string;
    smoking: string;
    kids: string;

    // Interests & Values
    interests: string[];
    values: string[];
    causes: string[];
    religion: string;
    politics: string;

    // Prompts & Bio
    prompts: { question: string; answer: string }[];
    bio: string;

    // Photos
    photos: (string | null)[];
}

interface RegistrationContextType {
    data: RegistrationData;
    updateData: (updates: Partial<RegistrationData>) => void;
    resetData: () => void;
}

const defaultData: RegistrationData = {
    phoneNumber: '',
    firstName: '',
    birthday: new Date(2000, 0, 1),
    gender: '',
    showGender: true,
    datingPreference: 'Everyone',
    mode: 'Date',
    intention: '',
    height: '',
    exercise: '',
    education: '',
    drinking: '',
    smoking: '',
    kids: '',
    interests: [],
    values: [],
    causes: [],
    religion: '',
    politics: '',
    prompts: [],
    bio: '',
    photos: [null, null, null, null, null, null],
};

const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined);

export function RegistrationProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState<RegistrationData>(defaultData);

    const updateData = (updates: Partial<RegistrationData>) => {
        setData(prev => ({ ...prev, ...updates }));
    };

    const resetData = () => {
        setData(defaultData);
    };

    return (
        <RegistrationContext.Provider value={{ data, updateData, resetData }}>
            {children}
        </RegistrationContext.Provider>
    );
}

export function useRegistration() {
    const context = useContext(RegistrationContext);
    if (!context) {
        throw new Error('useRegistration must be used within a RegistrationProvider');
    }
    return context;
}
