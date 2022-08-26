import React, { useState } from "react";
import * as sessionActions from "../../store/session";
import { useDispatch, useSelector } from "react-redux";
import { Redirect } from "react-router-dom";
import "./ReviewForm.css";
import { createNewReview } from "../../store/reviews";

function ReviewForm({ spotId }) {
  const dispatch = useDispatch();
  const sessionUser = useSelector((state) => state.session.user);
  const [review, setReview] = useState("");
  const [stars, setStars] = useState(0);
  const [errors, setErrors] = useState([]);
  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      review,
      stars,
    };
    if (review.length >= 256) {
      setErrors({ review: "Review must be less than 255 Characters!" });
    }
    console.log(review.length);
    if (review.length <= 255) {
      setErrors([]);
      dispatch(createNewReview(data, spotId)).catch(async (res) => {
        const data = await res.json();
        if (data && data.errors) setErrors(data.errors);
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <ul className="review_error">
        {Object.values(errors).map((error, idx) => (
          <li key={idx}>{error}</li>
        ))}
      </ul>
      <div className="review-input-item">
        <input
          placeholder="Review Description"
          type="text"
          maxLength="255"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          required
        />
      </div>
      <div className="review-input-item">
        <input
          placeholder="Rating (1-5)"
          type="number"
          min="1"
          max="5"
          value={stars}
          onChange={(e) => setStars(e.target.value)}
          required
        />
      </div>
      <button className="review-modal-submit" type="submit">
        Create Review
      </button>
    </form>
  );
}

export default ReviewForm;