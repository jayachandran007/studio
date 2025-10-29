
"use client";

import { useEffect, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { doc, onSnapshot, collection, addDoc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { Button } from './ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { cn } from '@/lib/utils';

interface VideoChatProps {
    firestore: Firestore;
    callId: string;
    currentUser: User;
}

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

    // For draggable PiP
    const pipRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 20, y: 80 }); // Initial position (from top-left)
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
                    description: 'Please enable camera permissions in your browser settings to use this feature.',
                });
            }
        };
        getCameraPermission();
    }, [toast]);
    
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };
    
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        e.preventDefault();
        const parentRect = pipRef.current?.parentElement?.getBoundingClientRect();
        if (!parentRect) return;

        let newX = e.clientX - dragStart.x;
        let newY = e.clientY - dragStart.y;
        
        // Constrain within parent bounds
        const pipRect = pipRef.current.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, parentRect.width - pipRect.width));
        newY = Math.max(0, Math.min(newY, parentRect.height - pipRect.height));

        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        });
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const parentRect = pipRef.current?.parentElement?.getBoundingClientRect();
        if (!parentRect) return;
        
        let newX = touch.clientX - dragStart.x;
        let newY = touch.clientY - dragStart.y;

        const pipRect = pipRef.current.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, parentRect.width - pipRect.width));
        newY = Math.max(0, Math.min(newY, parentRect.height - pipRect.height));

        setPosition({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    const startCall = async () => {
        if (!firestore || !currentUser || !localStream.current) {
            toast({ title: 'Error', description: 'Cannot start call. Resources not ready.', variant: 'destructive'});
            return;
        }
        setCallStatus('calling');

        const callDocRef = doc(firestore, 'videoCalls', callId);
        const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
        const answerCandidatesRef = collection(callDocRef, 'answerCandidates');
        
        pc.current = new RTCPeerConnection(servers);

        localStream.current.getTracks().forEach(track => {
            pc.current!.addTrack(track, localStream.current!);
        });

        remoteStream.current = new MediaStream();
        pc.current.ontrack = event => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.current!.addTrack(track);
            });
        };
        
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream.current;
        }

        pc.current.onicecandidate = async event => {
            if (event.candidate) {
                await addDoc(offerCandidatesRef, event.candidate.toJSON());
            }
        };

        const offerDescription = await pc.current.createOffer();
        await pc.current.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        await updateDoc(callDocRef, { offer });

        onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (data?.status === 'ringing') {
                setCallStatus('calling');
            }
            if (data?.answer) {
                if(!pc.current?.currentRemoteDescription) {
                    const answerDescription = new RTCSessionDescription(data.answer);
                    pc.current?.setRemoteDescription(answerDescription);
                }
                setCallStatus('in-call');
            }
        });

        onSnapshot(answerCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.current?.addIceCandidate(candidate);
                }
            });
        });
    };
    
    const answerCall = async () => {
        if (!firestore || !localStream.current) return;
        
        const callDocRef = doc(firestore, 'videoCalls', callId);
        const answerCandidatesRef = collection(callDocRef, 'answerCandidates');
        const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
        
        pc.current = new RTCPeerConnection(servers);

        localStream.current.getTracks().forEach(track => {
            pc.current!.addTrack(track, localStream.current!);
        });

        remoteStream.current = new MediaStream();
        pc.current.ontrack = event => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.current!.addTrack(track);
            });
        };
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream.current;
        }

        pc.current.onicecandidate = async event => {
            if (event.candidate) {
                await addDoc(answerCandidatesRef, event.candidate.toJSON());
            }
        };

        const callData = (await getDoc(callDocRef)).data();
        if (callData?.offer) {
            await pc.current.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answerDescription = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answerDescription);

            const answer = {
                type: answerDescription.type,
                sdp: answerDescription.sdp,
            };
            await updateDoc(callDocRef, { answer, status: 'connected' });
             setCallStatus('in-call');

            onSnapshot(offerCandidatesRef, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        let data = change.doc.data();
                        pc.current?.addIceCandidate(new RTCIceCandidate(data));
                    }
                });
            });
        }
    };


    const hangUp = async () => {
        if (pc.current) {
            pc.current.close();
        }
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }
        
        if (firestore) {
            const callDocRef = doc(firestore, 'videoCalls', callId);
            if((await getDoc(callDocRef)).exists()) {
                 await deleteDoc(callDocRef);
            }
        }

        pc.current = null;
        localStream.current = null;
        remoteStream.current = null;
        setCallStatus('idle');
        window.location.reload(); // Quick way to reset state
    };


    return (
        <div 
            className="relative w-full h-full"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            
            <div 
                ref={pipRef}
                className="absolute w-1/4 max-w-[120px] aspect-[9/16] rounded-lg overflow-hidden shadow-2xl cursor-move touch-none"
                style={{
                    top: position.y,
                    left: position.x,
                    display: hasCameraPermission ? 'block' : 'none'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>

            {hasCameraPermission === false && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Alert variant="destructive" className="max-w-sm">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera and microphone access to use the video call feature. Check your browser settings.
                        </AlertDescription>
                    </Alert>
                </div>
            )}
            
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
                {callStatus === 'idle' && hasCameraPermission && (
                    <>
                        <Button onClick={startCall} className='bg-green-500 hover:bg-green-600 rounded-full h-16 w-16 p-0'>
                            <Phone className="h-7 w-7" />
                        </Button>
                        <Button onClick={answerCall} variant="outline" className="bg-blue-500 hover:bg-blue-600 text-white rounded-full h-16 w-16 p-0 border-0">
                            Join Call
                        </Button>
                    </>
                )}

                {callStatus === 'calling' && <p className="text-white bg-black/30 px-4 py-2 rounded-full">Calling...</p>}
                
                {callStatus === 'in-call' && (
                    <Button onClick={hangUp} variant="destructive" className="rounded-full h-16 w-16 p-0">
                        <PhoneOff className="h-7 w-7" />
                    </Button>
                )}
            </div>
        </div>
    );
}
