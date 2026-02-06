export const MOCK_PROFILE = {
    userId: "user_me",
    name: "Jessica",
    age: 24,
    isVerified: true,
    photos: [
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        null, null, null
    ],
    details: {
        height: "165 cm",
        exercise: "Active",
        education: "Bachelors",
        drinking: "Socially",
        lookingFor: "Relationship"
    },
    prompts: [
        { question: "I'll know we vibe if...", answer: "You love hiking as much as I do!" }
    ]
};

export const MOCK_USERS = [
    {
        id: "1",
        name: "Sarah",
        age: 23,
        isVerified: true,
        kmDistance: 5,
        location: "Kochi, Kerala",
        bio: "Adventure seeker & coffee lover ☕",
        photos: [
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ],
        badges: [
            { type: "common", text: "You both like Hiking", icon: "walk" }
        ],
        tags: ["160 cm", "Active", "Non-smoker"],
        lookingFor: ["Fun, casual dates", "Intimacy"],
        interests: [
            { icon: "🎨", text: "Art" },
            { icon: "🍷", text: "Wine" },
            { icon: "⛺", text: "Camping" }
        ],
        prompts: [
            { question: "I'll know we vibe on a date if...", answer: "You can make me laugh until my stomach hurts." },
            { question: "My simple pleasures...", answer: "Early morning coffee and a good book." }
        ]
    },
    {
        id: "2",
        name: "Maya",
        age: 26,
        isVerified: false,
        kmDistance: 12,
        location: "Bangalore, India",
        bio: "Digital Nomad living my best life ✨",
        photos: [
            "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ],
        badges: [],
        tags: ["170 cm", "Yoga", "Vegan"],
        lookingFor: ["Relationship", "Marriage"],
        interests: [
            { icon: "🧘‍♀️", text: "Yoga" },
            { icon: "✈️", text: "Travel" }
        ],
        prompts: [
            { question: "A non-negotiable...", answer: "Must love dogs 🐕" }
        ]
    }
];
