import React, { useEffect, useState } from "react";
import api from "../api";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";

const EventList = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined) params.append(key, val);
      });

      const res = await api.get(`/events?${params.toString()}`);
      setEvents(res.data);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div>
      <EventFilters onFilter={fetchEvents} />
      {loading ? (
        <p>Loading events...</p>
      ) : (
        <div className="event-list">
          {events.map((event) => (
            <EventCard key={event.id} event={event} user={user} />
          ))}
        </div>
      )}
    </div>
  );
};

export default EventList;
