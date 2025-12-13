import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { SupabaseHost } from "../../supabase";

const Home = (props) => {
    const { userId } = useAuthStore();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            if (userId) {
                const { data, error } = await SupabaseHost
                    .from('host')
                    .select('*')
                    .eq('id', userId)
                    .single();
                if (data) {
                    setUserData(data);
                } else {
                    console.error('Error fetching user data:', error);
                }
            }
            setLoading(false);
        };
        fetchUserData();
    }, [userId]);

    if (loading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
    }

    if (!userData) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>User data not found.</div>;
    }

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Profile</h1>
            <div style={{
                backgroundColor: 'var(--surface)',
                borderRadius: '10px',
                padding: '20px',
                boxShadow: '0 4px 6px var(--card-shadow)',
                color: 'var(--text)'
            }}>
                <div style={{ marginBottom: '15px' }}>
                    <strong>Username:</strong> {userData.username}
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <strong>Balance:</strong> {userData.balance.toLocaleString()} Birr
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <strong>Created At:</strong> {new Date(userData.created_at).toLocaleString()}
                </div>
            </div>
        </div>
    );
};

export default Home;