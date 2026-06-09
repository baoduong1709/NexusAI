const fs = require('fs');

const path = './components/ai-chat-bubble.tsx';
let code = fs.readFileSync(path, 'utf-8');

// Add isStreaming state
code = code.replace(
  'const [reviewTasks, setReviewTasks] = useState<SuggestedTask[] | null>(null);',
  'const [reviewTasks, setReviewTasks] = useState<SuggestedTask[] | null>(null);\n  const [isStreaming, setIsStreaming] = useState(false);'
);

// Replace chatMutation and send
const regex = /  const chatMutation = useMutation\(\{[\s\S]*?chatMutation\.mutate\(\{ userMsg: msg, currentMessages: updatedMessages \}\);\n  \};/;

const newSendCode = `  const send = async () => {
    const msg = input.trim();
    if (!msg || !selectedProjectId || !activeSession || isStreaming)
      return;
    
    setInput("");
    
    // Optimistic update: append user message
    const userMsgObj: ChatMessage = { role: "user", content: msg };
    const updatedMessages = [...messages, userMsgObj];
    let currentSession = { ...activeSession, messages: updatedMessages };
    updateSession(currentSession);

    setIsStreaming(true);
    
    // Create an empty assistant message slot
    currentSession = {
       ...currentSession,
       messages: [
         ...currentSession.messages,
         { role: "assistant", content: "" }
       ]
    };
    setActiveSession(currentSession);

    try {
      const token = localStorage.getItem("nexusai_token");
      const url = \`\${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/projects/\${selectedProjectId}/ai/chat-stream\`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": \`Bearer \${token}\`
        },
        body: JSON.stringify({
          messages: updatedMessages,
          summary
        })
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let assistantMessage = "";
      let suggestedTasks: any[] | undefined = undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\\n");
        
        let currentEvent = "";
        
        for (const line of lines) {
           if (line.startsWith("event: ")) {
              currentEvent = line.substring(7).trim();
           } else if (line.startsWith("data: ")) {
              const dataStr = line.substring(6).trim();
              if (!dataStr) continue;
              
              if (currentEvent === "suggest_tasks") {
                 try { suggestedTasks = JSON.parse(dataStr); } catch (e) {}
              } else if (currentEvent === "error") {
                 try { toast.error(JSON.parse(dataStr).message); } catch(e) {}
              } else if (currentEvent === "done") {
                 // done
              } else {
                 try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.text) {
                       assistantMessage += parsed.text;
                       // update UI
                       setActiveSession(prev => {
                          if (!prev) return prev;
                          const newMsgs = [...prev.messages];
                          newMsgs[newMsgs.length - 1] = {
                             ...newMsgs[newMsgs.length - 1],
                             content: assistantMessage
                          };
                          return { ...prev, messages: newMsgs };
                       });
                    }
                 } catch (e) {}
              }
              currentEvent = "";
           }
        }
      }

      // Stream finished. Finalize and update backend
      setActiveSession(prev => {
         if (!prev) return prev;
         const finalMsgs = [...prev.messages];
         finalMsgs[finalMsgs.length - 1] = {
            ...finalMsgs[finalMsgs.length - 1],
            suggestedTasks
         };
         const finalSession = { ...prev, messages: finalMsgs };
         updateSessionMutation.mutate({ messages: finalMsgs });
         summarizeMutation.mutate({ session: finalSession, newMsgs: finalMsgs });
         return finalSession;
      });
      
      if (suggestedTasks?.length) setReviewTasks(suggestedTasks);

    } catch (e: any) {
       toast.error("Chat failed");
    } finally {
       setIsStreaming(false);
    }
  };`;

code = code.replace(regex, newSendCode);

// Fix chatMutation.isPending references in the UI
code = code.replace(/chatMutation\.isPending/g, 'isStreaming');

fs.writeFileSync(path, code);
console.log("Updated ai-chat-bubble.tsx");
