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

    // Basic email validation
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post("/contact", formData);
      toast.success(res.data?.message || "Message sent successfully! We'll get back to you soon.");
      
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
      toast.error(err.response?.data?.error || "Failed to send message. Please try again.");
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
            <div className="info-item">
              <i className="icon-email"></i>
              <div>
                <h4>Email</h4>
                <p>victorlabs854@gamail.com</p>
              </div>
            </div>
            <div className="info-item">
              <i className="icon-phone"></i>
              <div>
                <h4>Phone</h4>
                <p>+254 (7)59205319</p>
              </div>
            </div>
            <div className="info-item">
              <i className="icon-location"></i>
              <div>
                <h4>Office</h4>
                <p>MAIN CAMPUS WAY<br/>KARATINA</p>
              </div>
            </div>
            <div className="info-item">
              <i className="icon-clock"></i>
              <div>
                <h4>Business Hours</h4>
                <p>Monday - Friday: 9:00 AM - 6:00 PM<br/>
                   Saturday: 10:00 AM - 4:00 PM<br/>
                   Sunday: Closed</p>
              </div>
            </div>
          </div>

          <div className="contact-form-wrapper">
            <h3>Send Us a Message</h3>
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject *</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  placeholder="How can we help you?"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="priority">Priority</label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="low">Low - General inquiry</option>
                  <option value="medium">Medium - Need assistance</option>
                  <option value="high">High - Urgent issue</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Please describe your question or issue in detail..."
                  value={formData.message}
                  onChange={handleChange}
                  rows="6"
                  required
                />
              </div>

              <button 
                type="submit" 
                className="submit-btn"
                disabled={submitting}
              >
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