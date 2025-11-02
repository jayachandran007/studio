
"use client";

import { useEffect, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { doc, onSnapshot, collection, addDoc, updateDoc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { Button } from './ui/button';
import { Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { cn } from '@/lib/utils';

interface VideoChatProps {
    firestore: Firestore;
    callId: string;
    currentUser: User;
}

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

export function VideoChat({ firestore, callId, currentUser }: VideoChatProps) {
    const pc = useRef<RTCPeerConnection | null>(null);
    const localStream = useRef<MediaStream | null>(null);
    const remoteStream = useRef<MediaStream | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const isPermissionPromptOpen = useRef(false);

    const { toast } = useToast();
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'in-call' | 'error'>('idle');
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);

    const pipRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 20, y: 80 }); 
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const getCameraPermission = async () => {
            try {
                isPermissionPromptOpen.current = true;
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                isPermissionPromptOpen.current = false;
                localStream.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
            } catch (error) {
                console.error('Error accessing camera:', error);
                setHasCameraPermission(false);
                isPermissionPromptOpen.current = false;
                toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Please enable camera permissions to use this feature.',
                });
            }
        };
        getCameraPermission();
    }, [toast]);
    
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };
    
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging || !pipRef.current) return;
        e.preventDefault();
        const parentRect = pipRef.current.parentElement?.getBoundingClientRect();
        if (!parentRect) return;

        let newX = e.clientX - dragStart.x;
        let newY = e.clientY - dragStart.y;
        
        const pipRect = pipRef.current.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, parentRect.width - pipRect.width));
        newY = Math.max(0, Math.min(newY, parentRect.height - pipRect.height));

        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!isDragging || !pipRef.current) return;
        const touch = e.touches[0];
        const parentRect = pipRef.current.parentElement?.getBoundingClientRect();
        if (!parentRect) return;
        
        let newX = touch.clientX - dragStart.x;
        let newY = touch.clientY - dragStart.y;

        const pipRect = pipRef.current.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, parentRect.width - pipRect.width));
        newY = Math.max(0, Math.min(newY, parentRect.height - pipRect.height));

        setPosition({ x: newX, y: newY });
    };

    const handleTouchEnd = () => setIsDragging(false);

    const startPeerConnection = () => {
        pc.current = new RTCPeerConnection(servers);

        if (localStream.current) {
            localStream.current.getTracks().forEach(track => {
                pc.current!.addTrack(track, localStream.current!);
            });
        }
        
        remoteStream.current = new MediaStream();
        pc.current.ontrack = event => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.current!.addTrack(track);
            });
        };
        
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream.current;
        }
    }
    
    const startCall = async () => {
        if (!firestore || !currentUser || !localStream.current) {
            toast({ title: 'Error', description: 'Cannot start call. Resources not ready.', variant: 'destructive'});
            return;
        }
        setCallStatus('calling');
        startPeerConnection();

        const callDocRef = doc(firestore, 'videoCalls', callId);
        const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
        
        pc.current!.onicecandidate = async event => {
            if (event.candidate) await addDoc(offerCandidatesRef, event.candidate.toJSON());
        };

        const offerDescription = await pc.current!.createOffer();
        await pc.current!.setLocalDescription(offerDescription);

        const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
        const recipient = ALL_USERS.find(u => u.uid !== currentUser.uid);

        await setDoc(callDocRef, { offer, initiatorUid: currentUser.uid, recipientUid: recipient!.uid, status: 'ringing' });

        onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (data?.answer && !pc.current?.currentRemoteDescription) {
                const answerDescription = new RTCSessionDescription(data.answer);
                pc.current?.setRemoteDescription(answerDescription);
            }
            if (data?.status === 'connected') setCallStatus('in-call');
            if (!snapshot.exists()) hangUp(false); // Other user hung up
        });

        const answerCandidatesRef = collection(callDocRef, 'answerCandidates');
        onSnapshot(answerCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            });
        });
    };
    
    const answerCall = async () => {
        if (!firestore || !localStream.current || !currentUser) return;
        setCallStatus('in-call');
        startPeerConnection();

        const callDocRef = doc(firestore, 'videoCalls', callId);
        const answerCandidatesRef = collection(callDocRef, 'answerCandidates');
        
        pc.current!.onicecandidate = async event => {
            if (event.candidate) await addDoc(answerCandidatesRef, event.candidate.toJSON());
        };

        const callData = (await getDoc(callDocRef)).data();
        if (callData?.offer) {
            await pc.current!.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answerDescription = await pc.current!.createAnswer();
            await pc.current!.setLocalDescription(answerDescription);

            const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
            await updateDoc(callDocRef, { answer, status: 'connected' });

            onSnapshot(callDocRef, (snapshot) => {
                if (!snapshot.exists()) hangUp(false);
            });
            
            const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
            onSnapshot(offerCandidatesRef, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                });
            });
        }
    };

    const hangUp = async (isLocalHangup = true) => {
        pc.current?.close();
        localStream.current?.getTracks().forEach(track => track.stop());
        
        if (firestore && isLocalHangup) {
            const callDocRef = doc(firestore, 'videoCalls', callId);
            if((await getDoc(callDocRef)).exists()) await deleteDoc(callDocRef);
        }

        pc.current = null;
        setCallStatus('idle');
        setHasCameraPermission(null); // This will trigger a re-permission and UI reset
        window.location.reload(); // Force a clean state
    };
    
    const toggleVideo = () => {
        if (localStream.current) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };


    return (
        <div 
            className="relative w-full h-full bg-black"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            
            <div 
                ref={pipRef}
                className={cn(
                    "absolute w-1/4 max-w-[120px] aspect-[9/16] rounded-lg overflow-hidden shadow-2xl cursor-move touch-none bg-black",
                     !isVideoEnabled && "flex items-center justify-center"
                )}
                style={{
                    top: position.y,
                    left: position.x,
                    display: hasCameraPermission ? 'block' : 'none'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                <video ref={localVideoRef} autoPlay playsInline muted className={cn("w-full h-full object-cover", !isVideoEnabled && "hidden")} />
                 {!isVideoEnabled && <VideoOff className="h-8 w-8 text-white" />}
            </div>

            {hasCameraPermission === false && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Alert variant="destructive" className="max-w-sm m-4">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera and microphone access to use video calls. You may need to check your browser's settings.
                        </AlertDescription>
                    </Alert>
                </div>
            )}
            
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
                {callStatus === 'idle' && hasCameraPermission && (
                    <>
                        <Button onClick={startCall} className='bg-green-500 hover:bg-green-600 rounded-full h-16 w-16 p-0 text-white'>
                            <Phone className="h-7 w-7" />
                        </Button>
                        <Button onClick={answerCall} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full h-16 w-16 p-0 border-0">
                            Join
                        </Button>
                    </>
                )}

                {callStatus === 'calling' && <p className="text-white bg-black/30 px-4 py-2 rounded-full">Calling...</p>}
                
                {callStatus === 'in-call' && (
                    <>
                        <Button onClick={toggleVideo} variant="outline" className="bg-black/30 hover:bg-black/50 border-0 text-white rounded-full h-12 w-12 p-0">
                            {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                        </Button>
                        <Button onClick={() => hangUp(true)} variant="destructive" className="rounded-full h-16 w-16 p-0">
                            <PhoneOff className="h-7 w-7" />
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
