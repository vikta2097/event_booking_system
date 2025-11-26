import React, { useState } from "react";
import api from "../api";
import "../styles/ContactUs.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    priority: "low"
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim() || !formData.email.trim() ||
        !formData.subject.trim() || !formData.message.trim()) {
      toast.error("All fields are required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post("/contact", formData); // Matches your backend route
      toast.success(res.data?.message || "Message sent successfully!");

      // Reset form
      setFormData({
        name: "",
        email: "",
        subject: "",
        message: "",
        priority: "low"
      });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to send message. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="contact-container">
      <ToastContainer position="top-right" autoClose={4000} />

      <div className="contact-content">
        <div className="contact-header">
          <h1>Contact Us</h1>
          <p>Have a question or need assistance? We're here to help!</p>
        </div>

        <div className="contact-body">
          <div className="contact-info">
            <h3>Get in Touch</h3>
            <p>Email: victorlabs854@gmail.com</p>
            <p>Phone: +254 (7)59205319</p>
            <p>Office: MAIN CAMPUS WAY, KARATINA</p>
            <p>Business Hours: Mon-Fri 9:00-18:00, Sat 10:00-16:00, Sun Closed</p>
          </div>

          <div className="contact-form-wrapper">
            <h3>Send Us a Message</h3>
            <form onSubmit={handleSubmit} className="contact-form">
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                value={formData.name}
                onChange={handleChange}
                required
              />
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <input
                type="text"
                name="subject"
                placeholder="Subject"
                value={formData.subject}
                onChange={handleChange}
                required
              />
              <select name="priority" value={formData.priority} onChange={handleChange}>
                <option value="low">Low - General inquiry</option>
                <option value="medium">Medium - Need assistance</option>
                <option value="high">High - Urgent issue</option>
              </select>
              <textarea
                name="message"
                placeholder="Type your message here..."
                value={formData.message}
                onChange={handleChange}
                rows="6"
                required
              />
              <button type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
