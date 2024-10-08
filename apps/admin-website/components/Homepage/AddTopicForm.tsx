"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { createTopic } from "@/src/lib/actions";
import { useEffect, useState } from "react";
import { toast } from "sonner"; // Assuming you're using Sonner for toasts

export default function AddTopicForm() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await createTopic(formData);
    console.log("result is", result);
    // Handle success or warning messages with toast
    if (!result.err) {
      toast.success(result.msg || "Topic created successfully!"); // Ensure the message is present
      setIsDialogOpen(false); // Close the dialog on success
    } else {
      toast.warning(result.msg);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Topic
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Topic</DialogTitle>
          <DialogDescription>
            Enter a topic name to create a new topic.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="topicName">Topic Name</label>
            <Input
              id="topicName"
              name="topicName"
              placeholder="Enter topic name"
              required
            />
          </div>
          <Button type="submit">Submit</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
