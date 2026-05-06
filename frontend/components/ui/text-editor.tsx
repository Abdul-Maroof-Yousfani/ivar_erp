"use client"

import { useState, useEffect } from "react"
import { RichTextEditor } from "./rich-text-editor"

// Define SerializedEditorState type locally since lexical might not be installed
export interface SerializedEditorState {
  root: {
    children: any[];
    direction: string;
    format: string;
    indent: number;
    type: string;
    version: number;
  };
}

export const initialValue: SerializedEditorState = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "",
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
}

interface TextEditorProps {
  editorSerializedState: SerializedEditorState;
  onSerializedChange: (value: SerializedEditorState) => void;
}

// Helper function to convert SerializedEditorState to HTML string
function stateToHtml(state: SerializedEditorState): string {
  if (!state?.root?.children) return "";
  
  // Try to extract text from the state structure
  const extractText = (node: any): string => {
    if (node.type === "text" && node.text) {
      return node.text;
    }
    if (node.children && Array.isArray(node.children)) {
      return node.children.map(extractText).join("");
    }
    return "";
  };
  
  const text = state.root.children.map(extractText).join("");
  return text || "";
}

// Helper function to convert HTML string to SerializedEditorState
function htmlToState(html: string): SerializedEditorState {
  // Create a temporary div to extract text content
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const text = tempDiv.textContent || tempDiv.innerText || "";
  
  return {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: text,
              type: "text",
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  };
}

export default function TextEditor({
  editorSerializedState,
  onSerializedChange,
}: TextEditorProps) {
  const [htmlValue, setHtmlValue] = useState<string>(() => 
    stateToHtml(editorSerializedState)
  );

  useEffect(() => {
    const newHtml = stateToHtml(editorSerializedState);
    if (newHtml !== htmlValue) {
      setHtmlValue(newHtml);
    }
  }, [editorSerializedState]);

  const handleHtmlChange = (html: string) => {
    setHtmlValue(html);
    const newState = htmlToState(html);
    onSerializedChange(newState);
  };

  return (
    <RichTextEditor
      value={htmlValue}
      onChange={handleHtmlChange}
      placeholder="Enter letter content..."
    />
  )
}
