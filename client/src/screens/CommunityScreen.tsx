import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundGlow from '../components/BackgroundGlow';
import GlassCard from '../components/GlassCard';
import GradientButton from '../components/GradientButton';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../config/api';

const INTERESTS = [
    'Frontend',
    'Backend',
    'Full Stack',
    'UI/UX Design',
    'Data Science / ML / AI',
    'Product Management',
    'DevOps / Cloud',
    'Marketing / Sales',
    'Finance / Consulting',
];

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Consulting', 'Manufacturing', 'Media', 'Other'];
const POST_TYPES = ['Interview Experience', 'Interview Question', 'Resume Tip', 'Career Advice', 'Job Opportunity Share', 'Poll'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const VISIBILITIES = ['Public', 'Followers Only'];

const emptySignup = {
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    profilePhoto: '',
    occupation: 'Student',
    college: '',
    degreeField: '',
    graduationYear: '',
    lookingFor: 'Internship',
    company: '',
    role: '',
    experience: '',
    industry: 'Technology',
    openToOpportunities: 'Yes',
    interests: [] as string[],
    otherInterest: '',
};

const emptyPostDraft = {
    postType: 'Interview Experience',
    content: '',
    company: '',
    role: '',
    difficulty: 'Medium',
    visibility: 'Public',
    imageData: '',
    pollOptions: 'Yes\nNo',
};

export default function CommunityScreen() {
    const insets = useSafeAreaInsets();
    const { user, setUser } = useApp();
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [company, setCompany] = useState('');
    const [question, setQuestion] = useState('');
    const [posting, setPosting] = useState(false);
    const [postDraft, setPostDraft] = useState(emptyPostDraft);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
    const [expandedPosts, setExpandedPosts] = useState<Record<number, boolean>>({});
    const [composerFocused, setComposerFocused] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [signupOpen, setSignupOpen] = useState(false);
    const [signupStep, setSignupStep] = useState(1);
    const [signup, setSignup] = useState(emptySignup);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(false);

    const normalizedHandle = signup.username.trim().toLowerCase().replace(/^@/, '');
    const profileTitle = signup.occupation === 'Student'
        ? `${signup.degreeField || 'Student'} at ${signup.college || 'College'}`
        : `${signup.role || 'Professional'} at ${signup.company || 'Company'}`;

    const fetchPosts = async () => {
        try {
            const res = await apiFetch(`/posts${user?.id ? `?user_id=${user.id}` : ''}`);
            const data = await res.json();
            setPosts(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Failed to fetch posts', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, [user?.id]);

    const fetchLeaderboard = async () => {
        try {
            const res = await apiFetch('/leaderboard');
            const data = await res.json();
            setLeaderboard(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Failed to fetch leaderboard', e);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
    }, [posts.length]);

    const updateSignup = (patch: Partial<typeof emptySignup>) => {
        setSignup(prev => ({ ...prev, ...patch }));
        setAuthError(null);
    };

    const readProfilePhoto = (selected: File) => {
        if (Platform.OS !== 'web') return;
        const reader = new FileReader();
        reader.onload = () => updateSignup({ profilePhoto: String(reader.result || '') });
        reader.readAsDataURL(selected);
    };

    const validateSignupStep = () => {
        if (signupStep === 1) {
            if (!signup.name.trim() || !normalizedHandle || !signup.email.trim() || !signup.password) {
                return 'Fill name, username, email, and password.';
            }
            if (!/^[a-z0-9_]{3,24}$/.test(normalizedHandle)) {
                return 'Username must be 3-24 characters using letters, numbers, or underscores.';
            }
            if (signup.password.length < 8 || !/[A-Z]/.test(signup.password)) {
                return 'Password needs at least 8 characters and 1 capital letter.';
            }
            if (signup.password !== signup.confirmPassword) {
                return 'Passwords do not match.';
            }
        }
        if (signupStep === 2) {
            if (signup.occupation === 'Student' && (!signup.college.trim() || !signup.degreeField.trim() || !signup.graduationYear.trim())) {
                return 'Complete your student details.';
            }
            if (signup.occupation === 'Working Professional' && (!signup.company.trim() || !signup.role.trim() || !signup.experience.trim())) {
                return 'Complete your work details.';
            }
        }
        if (signupStep === 3 && signup.interests.length === 0 && !signup.otherInterest.trim()) {
            return 'Select at least one interest or add Other.';
        }
        return null;
    };

    const nextSignupStep = () => {
        const error = validateSignupStep();
        if (error) {
            setAuthError(error);
            return;
        }
        setAuthError(null);
        setSignupStep(prev => Math.min(4, prev + 1));
    };

    const handleLogin = async () => {
        setAuthLoading(true);
        setAuthError(null);
        try {
            const formData = new FormData();
            formData.append('email', loginEmail);
            formData.append('password', loginPassword);
            const res = await apiFetch('/login-check', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setUser({
                ...(data.user || {}),
                id: data.user_id,
                email: data.user?.email || loginEmail,
                name: data.user?.name || loginEmail.split('@')[0],
                token: data.token,
            });
        } catch (e: any) {
            setAuthError(e.message || 'Login failed.');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleCreateAccount = async () => {
        const error = validateSignupStep();
        if (error) {
            setAuthError(error);
            return;
        }
        setAuthLoading(true);
        setAuthError(null);
        try {
            const formData = new FormData();
            formData.append('name', signup.name);
            formData.append('username', normalizedHandle);
            formData.append('email', signup.email);
            formData.append('password', signup.password);
            formData.append('profile_photo', signup.profilePhoto);
            formData.append('occupation', signup.occupation);
            formData.append('college', signup.college);
            formData.append('degree_field', signup.degreeField);
            formData.append('graduation_year', signup.graduationYear);
            formData.append('looking_for', signup.lookingFor);
            formData.append('company', signup.company);
            formData.append('role', signup.role);
            formData.append('experience', signup.experience);
            formData.append('industry', signup.industry);
            formData.append('open_to_opportunities', signup.openToOpportunities);
            formData.append('interests', JSON.stringify(signup.interests));
            formData.append('other_interest', signup.otherInterest);
            const res = await apiFetch('/community-register', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setUser({ ...(data.user || {}), token: data.token });
            setSignupOpen(false);
            setSignupStep(1);
            setSignup(emptySignup);
        } catch (e: any) {
            setAuthError(e.message || 'Account creation failed.');
        } finally {
            setAuthLoading(false);
        }
    };

    const updatePostDraft = (patch: Partial<typeof emptyPostDraft>) => setPostDraft(prev => ({ ...prev, ...patch }));

    const insertFormat = (kind: 'bold' | 'bullet' | 'code') => {
        const snippet = kind === 'bold'
            ? '**important point**'
            : kind === 'bullet'
            ? '\n- key point'
            : '\n```\ncode or technical answer\n```';
        updatePostDraft({ content: `${postDraft.content}${snippet}` });
        setComposerFocused(true);
    };

    const readPostImage = (selected: File) => {
        if (Platform.OS !== 'web') return;
        const reader = new FileReader();
        reader.onload = () => updatePostDraft({ imageData: String(reader.result || '') });
        reader.readAsDataURL(selected);
    };

    const handlePost = async () => {
        if (!postDraft.content.trim() || !user?.id) return;
        setPosting(true);
        try {
            await apiFetch('/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    company_name: postDraft.company,
                    question: postDraft.content,
                    post_type: postDraft.postType,
                    role_tag: postDraft.role,
                    difficulty: postDraft.difficulty,
                    visibility: postDraft.visibility,
                    image_data: postDraft.imageData,
                    poll_options: postDraft.postType === 'Poll'
                        ? postDraft.pollOptions.split('\n').map(item => item.trim()).filter(Boolean)
                        : [],
                }),
            });
            setModalOpen(false);
            setPostDraft(emptyPostDraft);
            setComposerFocused(false);
            fetchPosts();
            fetchLeaderboard();
        } catch (e) {
            console.error('Failed to post', e);
        } finally {
            setPosting(false);
        }
    };

    const reactToPost = async (postId: number, reactionType: string) => {
        if (!user?.id) return;
        const formData = new FormData();
        formData.append('user_id', String(user.id));
        formData.append('reaction_type', reactionType);
        await apiFetch(`/posts/${postId}/react`, { method: 'POST', body: formData });
        fetchPosts();
        fetchLeaderboard();
    };

    const sharePost = async (post: any) => {
        const link = `http://localhost:8081/post/${post.id}`;
        if (Platform.OS === 'web' && navigator?.clipboard) {
            await navigator.clipboard.writeText(link);
        }
        await reactToPost(post.id, 'share');
    };

    const addComment = async (postId: number, parentId?: number) => {
        if (!user?.id || !commentDrafts[postId]?.trim()) return;
        await apiFetch(`/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, content: commentDrafts[postId], parent_id: parentId || null }),
        });
        setCommentDrafts(prev => ({ ...prev, [postId]: '' }));
        fetchPosts();
        fetchLeaderboard();
    };

    const likeComment = async (commentId: number) => {
        if (!user?.id) return;
        const formData = new FormData();
        formData.append('user_id', String(user.id));
        await apiFetch(`/comments/${commentId}/like`, { method: 'POST', body: formData });
        fetchPosts();
        fetchLeaderboard();
    };

    const toggleInterest = (interest: string) => {
        updateSignup({
            interests: signup.interests.includes(interest)
                ? signup.interests.filter(item => item !== interest)
                : [...signup.interests, interest],
        });
    };

    const sidebarWidth = sidebarOpen ? 330 : 72;

    return (
        <View style={styles.container}>
            <BackgroundGlow />
            <View style={styles.shell}>
                <View style={[styles.sidebar, { width: sidebarWidth, paddingTop: insets.top + 16 }]}>
                    <TouchableOpacity style={styles.collapseBtn} onPress={() => setSidebarOpen(!sidebarOpen)}>
                        <Ionicons name={sidebarOpen ? 'chevron-back' : 'chevron-forward'} size={20} color="#E2E8F0" />
                    </TouchableOpacity>

                    {sidebarOpen ? (
                        user ? (
                            <View>
                                <Text style={styles.sideEyebrow}>Community Profile</Text>
                                <View style={styles.profileBlock}>
                                    <View style={styles.bigAvatar}>
                                        {user.profile_photo ? (
                                            React.createElement('img', { src: user.profile_photo, style: styles.avatarImage as any })
                                        ) : (
                                            <Text style={styles.bigAvatarText}>{(user.name || user.email || 'U')[0]}</Text>
                                        )}
                                    </View>
                                    <Text style={styles.profileName}>{user.name}</Text>
                                    <Text style={styles.profileHandle}>@{user.username || user.email.split('@')[0]}</Text>
                                    <Text style={styles.profileMeta}>{user.occupation || 'Resumetric member'}</Text>
                                </View>
                                <View style={styles.profileStats}>
                                    <View><Text style={styles.statNum}>{user.points || 0}</Text><Text style={styles.statLabel}>Points</Text></View>
                                    <View><Text style={styles.statNum}>{user.interests?.length || 0}</Text><Text style={styles.statLabel}>Interests</Text></View>
                                </View>
                                <Text style={styles.reputationPill}>{user.reputation_level || 'Newcomer'}</Text>
                                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setUser(null)}>
                                    <Ionicons name="log-out-outline" size={17} color="#F87171" />
                                    <Text style={[styles.secondaryText, { color: '#F87171' }]}>Sign out</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.sideEyebrow}>Resumetric Social</Text>
                                <Text style={styles.sideTitle}>Join the career community</Text>
                                <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#64748B" autoCapitalize="none" value={loginEmail} onChangeText={setLoginEmail} />
                                <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#64748B" secureTextEntry value={loginPassword} onChangeText={setLoginPassword} />
                                {authError && !signupOpen && <Text style={styles.errorText}>{authError}</Text>}
                                <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={authLoading}>
                                    {authLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginText}>Login</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.createBtn} onPress={() => { setSignupOpen(true); setAuthError(null); }}>
                                    <Ionicons name="person-add-outline" size={18} color="#38BDF8" />
                                    <Text style={styles.createText}>Create Account</Text>
                                </TouchableOpacity>
                            </View>
                        )
                    ) : (
                        <View style={styles.railIcons}>
                            <Ionicons name={user ? 'person-circle-outline' : 'log-in-outline'} size={28} color="#E2E8F0" />
                            <Ionicons name="people-outline" size={26} color="#64748B" />
                        </View>
                    )}
                </View>

                <ScrollView contentContainerStyle={[styles.feed, { paddingTop: insets.top + 24, paddingBottom: 100 }]}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Community Feed</Text>
                            <Text style={styles.subtitle}>Interview questions, role advice, and peer learning</Text>
                        </View>
                        <TouchableOpacity style={styles.askBtn} onPress={() => setModalOpen(true)} disabled={!user}>
                            <Ionicons name="add" size={18} color="#FFFFFF" />
                            <Text style={styles.askText}>{user ? 'Share Question' : 'Login to Post'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.topicRow}>
                        {['Interview Prep', 'Resume Review', 'Job Search', 'Referrals'].map(topic => (
                            <View key={topic} style={styles.topicPill}><Text style={styles.topicText}>{topic}</Text></View>
                        ))}
                    </View>

                    <GlassCard style={styles.composerCard}>
                        <View style={styles.composerHeader}>
                            <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || 'U')[0]}</Text></View>
                            <TextInput
                                style={styles.composerInput}
                                placeholder={user ? 'Share your interview experience...' : 'Login to share with the community'}
                                placeholderTextColor="#64748B"
                                value={postDraft.content}
                                onChangeText={content => updatePostDraft({ content })}
                                onFocus={() => setComposerFocused(true)}
                                editable={!!user}
                                multiline
                            />
                        </View>
                        {(composerFocused || postDraft.content) && (
                            <View>
                                <View style={styles.typeRow}>
                                    {POST_TYPES.map(type => <Choice key={type} label={type} active={postDraft.postType === type} onPress={() => updatePostDraft({ postType: type })} />)}
                                </View>
                                <View style={styles.inlineGrid}>
                                    <TextInput style={[styles.input, styles.inlineInput]} placeholder="Company tag" placeholderTextColor="#64748B" value={postDraft.company} onChangeText={company => updatePostDraft({ company })} />
                                    <TextInput style={[styles.input, styles.inlineInput]} placeholder="Role tag" placeholderTextColor="#64748B" value={postDraft.role} onChangeText={role => updatePostDraft({ role })} />
                                </View>
                                <View style={styles.typeRow}>{DIFFICULTIES.map(item => <Choice key={item} label={item} active={postDraft.difficulty === item} onPress={() => updatePostDraft({ difficulty: item })} />)}</View>
                                <View style={styles.typeRow}>{VISIBILITIES.map(item => <Choice key={item} label={item} active={postDraft.visibility === item} onPress={() => updatePostDraft({ visibility: item })} />)}</View>
                                {postDraft.postType === 'Poll' && <TextInput style={[styles.input, styles.questionInput]} placeholder="Poll options, one per line" placeholderTextColor="#64748B" multiline value={postDraft.pollOptions} onChangeText={pollOptions => updatePostDraft({ pollOptions })} />}
                                <View style={styles.editorToolbar}>
                                    <TouchableOpacity style={styles.toolBtn} onPress={() => insertFormat('bold')}><Text style={styles.toolText}>B</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.toolBtn} onPress={() => insertFormat('bullet')}><Text style={styles.toolText}>•</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.toolBtn} onPress={() => insertFormat('code')}><Text style={styles.toolText}>{'</>'}</Text></TouchableOpacity>
                                    {Platform.OS === 'web' && React.createElement('input', { type: 'file', accept: 'image/*', onChange: (e: any) => e.target.files?.[0] && readPostImage(e.target.files[0]), style: styles.smallFileInput as any })}
                                    <TouchableOpacity style={styles.postSubmit} onPress={handlePost} disabled={!user || posting || !postDraft.content.trim()}>
                                        {posting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.postSubmitText}>Post</Text>}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </GlassCard>

                    <View style={styles.leaderboardCard}>
                        <Text style={styles.leaderTitle}>Weekly top contributors</Text>
                        <View style={styles.typeRow}>
                            {['All Time', 'This Week', 'By Role', 'By Company'].map(item => <View key={item} style={styles.filterPill}><Text style={styles.filterText}>{item}</Text></View>)}
                        </View>
                        {leaderboard.slice(0, 10).map((member, index) => (
                            <View key={member.id || index} style={styles.leaderRow}>
                                <Text style={styles.rankText}>#{index + 1}</Text>
                                <Text style={styles.leaderName}>{member.name}</Text>
                                <Text style={styles.leaderPoints}>{member.points || 0} pts</Text>
                            </View>
                        ))}
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#5B8CFF" style={{ marginTop: 40 }} />
                    ) : (
                        posts.map((post, i) => (
                            <Animated.View key={post.id} entering={FadeInDown.delay(i * 80).duration(500)}>
                                <GlassCard style={styles.postCard}>
                                    <View style={styles.postHeader}>
                                        <View style={styles.avatar}>
                                            {post.author_photo ? React.createElement('img', { src: post.author_photo, style: styles.avatarImage as any }) : <Text style={styles.avatarText}>{post.author_name?.[0] || 'U'}</Text>}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.authorName}>{post.author_name} <Text style={styles.occupationBadge}>{post.author_occupation || 'Member'}</Text></Text>
                                            <Text style={styles.timeText}>{post.created_at ? new Date(post.created_at).toLocaleString() : 'Just now'}</Text>
                                        </View>
                                        <View style={styles.postTypeBadge}><Text style={styles.postTypeText}>{post.post_type}</Text></View>
                                    </View>
                                    <Text style={styles.questionText}>
                                        {expandedPosts[post.id] || post.question?.length < 260 ? post.question : `${post.question.slice(0, 260)}...`}
                                    </Text>
                                    {post.question?.length >= 260 && (
                                        <TouchableOpacity onPress={() => setExpandedPosts(prev => ({ ...prev, [post.id]: !prev[post.id] }))}>
                                            <Text style={styles.expandText}>{expandedPosts[post.id] ? 'Show less' : 'Read more'}</Text>
                                        </TouchableOpacity>
                                    )}
                                    <View style={styles.tagRow}>
                                        {!!post.company_name && <View style={styles.companyBadge}><Text style={styles.companyText}>{post.company_name}</Text></View>}
                                        {!!post.role_tag && <View style={styles.roleBadge}><Text style={styles.roleText}>{post.role_tag}</Text></View>}
                                        {!!post.difficulty && <View style={styles.diffBadge}><Text style={styles.diffText}>{post.difficulty}</Text></View>}
                                    </View>
                                    {!!post.image_data && React.createElement('img', { src: post.image_data, style: styles.postImage as any })}
                                    {post.poll_options?.length > 0 && (
                                        <View style={styles.pollBox}>
                                            {post.poll_options.map((option: string) => <View key={option} style={styles.pollOption}><Text style={styles.pollText}>{option}</Text></View>)}
                                        </View>
                                    )}
                                    <View style={styles.postFooter}>
                                        <TouchableOpacity style={styles.footerBtn} onPress={() => reactToPost(post.id, 'like')}><Ionicons name={post.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color="#94A3B8" /><Text style={styles.footerBtnText}>{post.like_count || 0}</Text></TouchableOpacity>
                                        <TouchableOpacity style={styles.footerBtn}><Ionicons name="chatbubble-outline" size={18} color="#94A3B8" /><Text style={styles.footerBtnText}>{post.comment_count || 0}</Text></TouchableOpacity>
                                        <TouchableOpacity style={styles.footerBtn} onPress={() => sharePost(post)}><Ionicons name="share-social-outline" size={18} color="#94A3B8" /><Text style={styles.footerBtnText}>{post.share_count || 0}</Text></TouchableOpacity>
                                        <TouchableOpacity style={styles.footerBtn} onPress={() => reactToPost(post.id, 'save')}><Ionicons name={post.saved ? 'bookmark' : 'bookmark-outline'} size={18} color="#94A3B8" /><Text style={styles.footerBtnText}>{post.save_count || 0}</Text></TouchableOpacity>
                                    </View>
                                    <View style={styles.commentsBox}>
                                        {(post.comments || []).slice(0, 4).map((comment: any) => (
                                            <View key={comment.id} style={[styles.commentRow, comment.parent_id && styles.replyRow]}>
                                                <Text style={styles.commentText}><Text style={styles.commentAuthor}>@{comment.author_name}</Text> {comment.content}</Text>
                                                <TouchableOpacity onPress={() => likeComment(comment.id)}><Text style={styles.commentLike}>{comment.like_count || 0} likes</Text></TouchableOpacity>
                                            </View>
                                        ))}
                                        {user && (
                                            <View style={styles.commentInputRow}>
                                                <TextInput
                                                    style={styles.commentInput}
                                                    placeholder="Write a comment or @mention someone..."
                                                    placeholderTextColor="#64748B"
                                                    value={commentDrafts[post.id] || ''}
                                                    onChangeText={text => setCommentDrafts(prev => ({ ...prev, [post.id]: text }))}
                                                />
                                                <TouchableOpacity onPress={() => addComment(post.id)}><Text style={styles.commentPost}>Post</Text></TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </GlassCard>
                            </Animated.View>
                        ))
                    )}
                </ScrollView>
            </View>

            <Modal visible={signupOpen} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.signupModal}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Create Community Account</Text>
                                <Text style={styles.modalSub}>Step {signupStep} of 4</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSignupOpen(false)}>
                                <Ionicons name="close" size={24} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.stepsRow}>
                            {[1, 2, 3, 4].map(step => <View key={step} style={[styles.stepDot, signupStep >= step && styles.stepDotActive]} />)}
                        </View>

                        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                            {signupStep === 1 && (
                                <View>
                                    <Text style={styles.formTitle}>Basic Info</Text>
                                    <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#64748B" value={signup.name} onChangeText={name => updateSignup({ name })} />
                                    <TextInput style={styles.input} placeholder="@username" placeholderTextColor="#64748B" autoCapitalize="none" value={signup.username} onChangeText={username => updateSignup({ username })} />
                                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#64748B" autoCapitalize="none" value={signup.email} onChangeText={email => updateSignup({ email })} />
                                    <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#64748B" secureTextEntry value={signup.password} onChangeText={password => updateSignup({ password })} />
                                    <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#64748B" secureTextEntry value={signup.confirmPassword} onChangeText={confirmPassword => updateSignup({ confirmPassword })} />
                                    {Platform.OS === 'web' && React.createElement('input', { type: 'file', accept: 'image/*', onChange: (e: any) => e.target.files?.[0] && readProfilePhoto(e.target.files[0]), style: styles.fileInput as any })}
                                </View>
                            )}

                            {signupStep === 2 && (
                                <View>
                                    <Text style={styles.formTitle}>Occupation</Text>
                                    <View style={styles.segment}>
                                        {['Student', 'Working Professional'].map(item => (
                                            <TouchableOpacity key={item} style={[styles.segmentBtn, signup.occupation === item && styles.segmentActive]} onPress={() => updateSignup({ occupation: item })}>
                                                <Text style={[styles.segmentText, signup.occupation === item && styles.segmentTextActive]}>{item === 'Student' ? 'I am a Student' : 'I am Working Professional'}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {signup.occupation === 'Student' ? (
                                        <View>
                                            <TextInput style={styles.input} placeholder="College/University name" placeholderTextColor="#64748B" value={signup.college} onChangeText={college => updateSignup({ college })} />
                                            <TextInput style={styles.input} placeholder="Degree & Field of Study" placeholderTextColor="#64748B" value={signup.degreeField} onChangeText={degreeField => updateSignup({ degreeField })} />
                                            <TextInput style={styles.input} placeholder="Graduation Year" placeholderTextColor="#64748B" value={signup.graduationYear} onChangeText={graduationYear => updateSignup({ graduationYear })} />
                                            <View style={styles.choiceRow}>{['Internship', 'Full-time', 'Both'].map(item => <Choice key={item} label={item} active={signup.lookingFor === item} onPress={() => updateSignup({ lookingFor: item })} />)}</View>
                                        </View>
                                    ) : (
                                        <View>
                                            <TextInput style={styles.input} placeholder="Current Company" placeholderTextColor="#64748B" value={signup.company} onChangeText={company => updateSignup({ company })} />
                                            <TextInput style={styles.input} placeholder="Job Title / Role" placeholderTextColor="#64748B" value={signup.role} onChangeText={role => updateSignup({ role })} />
                                            <TextInput style={styles.input} placeholder="Years of Experience" placeholderTextColor="#64748B" value={signup.experience} onChangeText={experience => updateSignup({ experience })} />
                                            <View style={styles.choiceRow}>{INDUSTRIES.map(item => <Choice key={item} label={item} active={signup.industry === item} onPress={() => updateSignup({ industry: item })} />)}</View>
                                            <View style={styles.choiceRow}>{['Yes', 'No'].map(item => <Choice key={item} label={`Open: ${item}`} active={signup.openToOpportunities === item} onPress={() => updateSignup({ openToOpportunities: item })} />)}</View>
                                        </View>
                                    )}
                                </View>
                            )}

                            {signupStep === 3 && (
                                <View>
                                    <Text style={styles.formTitle}>Interests</Text>
                                    <View style={styles.tagGrid}>
                                        {INTERESTS.map(item => <Choice key={item} label={item} active={signup.interests.includes(item)} onPress={() => toggleInterest(item)} />)}
                                    </View>
                                    <TextInput style={styles.input} placeholder="Other interest" placeholderTextColor="#64748B" value={signup.otherInterest} onChangeText={otherInterest => updateSignup({ otherInterest })} />
                                </View>
                            )}

                            {signupStep === 4 && (
                                <View>
                                    <Text style={styles.formTitle}>Profile Preview</Text>
                                    <View style={styles.previewCard}>
                                        <View style={styles.bigAvatar}>
                                            {signup.profilePhoto ? React.createElement('img', { src: signup.profilePhoto, style: styles.avatarImage as any }) : <Text style={styles.bigAvatarText}>{signup.name?.[0] || 'U'}</Text>}
                                        </View>
                                        <Text style={styles.profileName}>{signup.name || 'Your Name'}</Text>
                                        <Text style={styles.profileHandle}>@{normalizedHandle || 'username'}</Text>
                                        <Text style={styles.profileMeta}>{profileTitle}</Text>
                                        <View style={styles.tagGrid}>{[...signup.interests, signup.otherInterest].filter(Boolean).slice(0, 6).map(item => <View key={item} style={styles.previewTag}><Text style={styles.previewTagText}>{item}</Text></View>)}</View>
                                    </View>
                                </View>
                            )}

                            {authError && <Text style={styles.errorText}>{authError}</Text>}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => signupStep === 1 ? setSignupOpen(false) : setSignupStep(signupStep - 1)}>
                                <Text style={styles.secondaryText}>{signupStep === 1 ? 'Cancel' : 'Back'}</Text>
                            </TouchableOpacity>
                            <GradientButton title={signupStep === 4 ? 'Confirm & Create Account' : 'Continue'} onPress={signupStep === 4 ? handleCreateAccount : nextSignupStep} disabled={authLoading} style={styles.actionBtn} />
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={isModalOpen} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={styles.postModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Share a Question</Text>
                            <TouchableOpacity onPress={() => setModalOpen(false)}><Ionicons name="close" size={24} color="#94A3B8" /></TouchableOpacity>
                        </View>
                        <TextInput style={styles.input} placeholder="Company tag" placeholderTextColor="#64748B" value={postDraft.company} onChangeText={company => updatePostDraft({ company })} />
                        <TextInput style={styles.input} placeholder="Role tag" placeholderTextColor="#64748B" value={postDraft.role} onChangeText={role => updatePostDraft({ role })} />
                        <TextInput style={[styles.input, styles.questionInput]} placeholder="Share your post..." placeholderTextColor="#64748B" multiline value={postDraft.content} onChangeText={content => updatePostDraft({ content })} />
                        <TouchableOpacity style={[styles.loginBtn, posting && { opacity: 0.7 }]} onPress={handlePost} disabled={posting}>
                            {posting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginText}>Post to Community</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity style={[styles.choice, active && styles.choiceActive]} onPress={onPress}>
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050811' },
    shell: { flex: 1, flexDirection: 'row' },
    sidebar: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(7,11,22,0.92)', paddingHorizontal: 18 },
    collapseBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 24 },
    sideEyebrow: { color: '#38BDF8', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.3, marginBottom: 8 },
    sideTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', marginBottom: 22 },
    input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 13, color: '#FFFFFF', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontSize: 14 },
    loginBtn: { backgroundColor: '#5B8CFF', padding: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
    loginText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
    createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(56,189,248,0.28)' },
    createText: { color: '#38BDF8', fontWeight: '800', marginLeft: 8 },
    railIcons: { alignItems: 'center', gap: 24 },
    profileBlock: { alignItems: 'center', paddingVertical: 12 },
    bigAvatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#5B8CFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 },
    avatarImage: { width: '100%', height: '100%', objectFit: 'cover' },
    bigAvatarText: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
    profileName: { color: '#F8FAFC', fontSize: 20, fontWeight: '900', textAlign: 'center' },
    profileHandle: { color: '#38BDF8', fontSize: 13, marginTop: 3 },
    profileMeta: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
    profileStats: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 14, marginVertical: 18 },
    statNum: { color: '#F8FAFC', fontWeight: '900', textAlign: 'center', fontSize: 18 },
    statLabel: { color: '#64748B', fontSize: 11, marginTop: 4 },
    reputationPill: { color: '#FDE68A', textAlign: 'center', fontSize: 12, fontWeight: '900', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(251,191,36,0.12)', overflow: 'hidden', marginBottom: 12 },
    feed: { paddingHorizontal: 24, flexGrow: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { color: '#F8FAFC', fontSize: 30, fontWeight: '900' },
    subtitle: { color: '#94A3B8', fontSize: 14, marginTop: 4 },
    askBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8B5CF6', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
    askText: { color: '#FFFFFF', fontWeight: '900', marginLeft: 6 },
    topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
    topicPill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    topicText: { color: '#CBD5E1', fontWeight: '700', fontSize: 12 },
    composerCard: { marginBottom: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(91,140,255,0.22)' },
    composerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    composerInput: { flex: 1, minHeight: 54, color: '#F8FAFC', fontSize: 15, lineHeight: 21, paddingVertical: 10 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    inlineGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
    inlineInput: { flex: 1, marginBottom: 0 },
    editorToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    toolBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
    toolText: { color: '#CBD5E1', fontWeight: '900' },
    smallFileInput: { color: '#CBD5E1', flex: 1 },
    postSubmit: { backgroundColor: '#5B8CFF', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, minWidth: 72, alignItems: 'center' },
    postSubmitText: { color: '#FFFFFF', fontWeight: '900' },
    leaderboardCard: { marginBottom: 20, padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    leaderTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '900' },
    filterPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(56,189,248,0.1)' },
    filterText: { color: '#BAE6FD', fontSize: 11, fontWeight: '800' },
    leaderRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10 },
    rankText: { color: '#64748B', width: 36, fontWeight: '900' },
    leaderName: { color: '#CBD5E1', flex: 1, fontWeight: '800' },
    leaderPoints: { color: '#FDE68A', fontWeight: '900' },
    postCard: { marginBottom: 16, padding: 16 },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#5B8CFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
    authorName: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
    occupationBadge: { color: '#A7F3D0', fontSize: 11, fontWeight: '900' },
    timeText: { color: '#64748B', fontSize: 11, marginTop: 2 },
    postTypeBadge: { paddingVertical: 6, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(168,85,247,0.14)' },
    postTypeText: { color: '#DDD6FE', fontSize: 11, fontWeight: '900' },
    companyBadge: { backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 3 },
    companyText: { color: '#3B82F6', fontSize: 11, fontWeight: '700' },
    questionText: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, marginBottom: 16 },
    expandText: { color: '#38BDF8', fontWeight: '800', marginTop: -8, marginBottom: 12 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    roleBadge: { backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    roleText: { color: '#4ADE80', fontSize: 11, fontWeight: '800' },
    diffBadge: { backgroundColor: 'rgba(251,191,36,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    diffText: { color: '#FBBF24', fontSize: 11, fontWeight: '800' },
    postImage: { width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 12, marginBottom: 12 },
    pollBox: { gap: 8, marginBottom: 12 },
    pollOption: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    pollText: { color: '#E2E8F0', fontWeight: '800' },
    postFooter: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 },
    footerBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
    footerBtnText: { color: '#94A3B8', fontSize: 13, marginLeft: 6 },
    commentsBox: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', marginTop: 12, paddingTop: 12 },
    commentRow: { marginBottom: 8 },
    replyRow: { marginLeft: 18 },
    commentText: { color: '#CBD5E1', fontSize: 13, lineHeight: 19 },
    commentAuthor: { color: '#F8FAFC', fontWeight: '900' },
    commentLike: { color: '#64748B', fontSize: 11, marginTop: 2 },
    commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
    commentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: '#F8FAFC', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
    commentPost: { color: '#38BDF8', fontWeight: '900' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    signupModal: { width: '100%', maxWidth: 760, backgroundColor: '#0B0F1A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 22 },
    postModal: { width: '100%', maxWidth: 560, backgroundColor: '#0B0F1A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 22 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '900' },
    modalSub: { color: '#64748B', fontSize: 12, marginTop: 4 },
    stepsRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
    stepDot: { flex: 1, height: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
    stepDotActive: { backgroundColor: '#5B8CFF' },
    formTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '900', marginBottom: 12 },
    fileInput: { color: '#CBD5E1', marginBottom: 12 },
    segment: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 14 },
    segmentBtn: { flex: 1, padding: 11, borderRadius: 9, alignItems: 'center' },
    segmentActive: { backgroundColor: '#5B8CFF' },
    segmentText: { color: '#94A3B8', fontWeight: '800', fontSize: 12 },
    segmentTextActive: { color: '#FFFFFF' },
    choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    choice: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' },
    choiceActive: { backgroundColor: 'rgba(91,140,255,0.2)', borderColor: '#5B8CFF' },
    choiceText: { color: '#CBD5E1', fontSize: 12, fontWeight: '800' },
    choiceTextActive: { color: '#FFFFFF' },
    previewCard: { alignItems: 'center', padding: 20, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    previewTag: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(56,189,248,0.12)' },
    previewTagText: { color: '#BAE6FD', fontSize: 11, fontWeight: '800' },
    modalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18 },
    secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
    secondaryText: { color: '#CBD5E1', fontWeight: '800', marginLeft: 6 },
    actionBtn: { flex: 1 },
    errorText: { color: '#F87171', fontSize: 13, fontWeight: '800', lineHeight: 19, marginBottom: 12 },
    questionInput: { height: 120, textAlignVertical: 'top' },
});
