/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx) {
		// Check if database binding exists
		if (!env.feedback_db) {
			return new Response(
				JSON.stringify({ error: "Database binding not configured. Please check wrangler.jsonc" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" }
				}
			);
		}

		// Fetch customer feedback data with error handling
		let feedback = [];
		try {
			const result = await env.feedback_db
				.prepare("SELECT * FROM feedback")
				.all();
			feedback = result.results || [];
		} catch (error) {
			// If table doesn't exist or query fails, return error page
			const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Database Error - PM Dashboard</title>
	<style>
		body {
			font-family: Arial, sans-serif;
			max-width: 600px;
			margin: 100px auto;
			padding: 20px;
			background-color: #f5f5f5;
		}
		.error-box {
			background-color: white;
			padding: 30px;
			border-radius: 5px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		h1 { color: #d32f2f; }
		code {
			background-color: #f5f5f5;
			padding: 2px 6px;
			border-radius: 3px;
			font-family: monospace;
		}
	</style>
</head>
<body>
	<div class="error-box">
		<h1>Database Setup Required</h1>
		<p>The database table doesn't exist yet. Please run:</p>
		<pre><code>npx wrangler d1 execute feedback_db --file=./schema.sql</code></pre>
		<p>Then insert sample data:</p>
		<pre><code>npx wrangler d1 execute feedback_db --file=./insert_feedback.sql</code></pre>
		<p><strong>Error details:</strong> ${error.message}</p>
	</div>
</body>
</html>`;
			return new Response(errorHtml, {
				status: 500,
				headers: { "Content-Type": "text/html; charset=UTF-8" }
			});
		}

		// Calculate summary statistics
		const total = feedback.length;
		const positive = feedback.filter(f => f.sentiment === "positive").length;
		const neutral = feedback.filter(f => f.sentiment === "neutral").length;
		const negative = feedback.filter(f => f.sentiment === "negative").length;
		
		// Calculate percentages
		const positivePercent = total > 0 ? Math.round((positive / total) * 100) : 0;
		const neutralPercent = total > 0 ? Math.round((neutral / total) * 100) : 0;
		const negativePercent = total > 0 ? Math.round((negative / total) * 100) : 0;

		// Generate insights from feedback (no AI - based on data analysis)
		let insightsHTML = '';
		if (total > 0) {
			// Escape HTML helper function
			const escapeHtml = (text) => {
				if (!text) return '';
				return text
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#039;');
			};

			// Generate insights based on feedback data
			const sources = [...new Set(feedback.map(f => f.source))];
			const negativeFeedback = feedback.filter(f => f.sentiment === 'negative');
			const positiveFeedback = feedback.filter(f => f.sentiment === 'positive');
			
			// Generate summary
			const summaryText = `Based on ${total} feedback entries, customers have provided ${positive} positive, ${neutral} neutral, and ${negative} negative responses. The feedback spans across ${sources.length} different sources including ${sources.slice(0, 3).join(', ')}.`;
			
			// Generate themes from common words in comments
			const allComments = feedback.map(f => f.comment.toLowerCase()).join(' ');
			const commonIssues = [];
			if (allComments.includes('slow') || allComments.includes('performance')) commonIssues.push('Performance Issues');
			if (allComments.includes('bug') || allComments.includes('crash')) commonIssues.push('Bugs & Stability');
			if (allComments.includes('ui') || allComments.includes('interface') || allComments.includes('design')) commonIssues.push('User Interface');
			if (allComments.includes('feature') || allComments.includes('missing')) commonIssues.push('Feature Requests');
			if (allComments.includes('onboarding') || allComments.includes('confusing')) commonIssues.push('User Experience');
			
			const themesList = commonIssues.length > 0 ? commonIssues : ['General Feedback', 'Product Experience', 'Feature Requests'];
			
			// Generate actionable insights
			const insightsList = [];
			if (negative > 0) {
				insightsList.push(`Address ${negative} negative feedback items, particularly around ${negativeFeedback[0]?.comment.substring(0, 50)}...`);
			}
			if (sources.length > 3) {
				insightsList.push(`Feedback is coming from ${sources.length} different channels - consider consolidating or improving integration.`);
			}
			if (positivePercent < 50) {
				insightsList.push(`With ${positivePercent}% positive sentiment, focus on improving areas mentioned in neutral and negative feedback.`);
			} else {
				insightsList.push(`Strong ${positivePercent}% positive sentiment indicates good product-market fit - continue building on strengths.`);
			}

			insightsHTML = `
		<div class="insight-section">
			<h3>Summary</h3>
			<p>${escapeHtml(summaryText)}</p>
		</div>
		<div class="insight-section">
			<h3>Key Themes</h3>
			<ul>
				${themesList.map(theme => `<li><span class="insight-badge">Theme</span>${escapeHtml(theme)}</li>`).join('')}
			</ul>
		</div>
		<div class="insight-section">
			<h3>Actionable Insights</h3>
			<ul>
				${insightsList.map(insight => `<li>${escapeHtml(insight)}</li>`).join('')}
			</ul>
		</div>
			`;
		} else {
			insightsHTML = '<p>No feedback available to analyze.</p>';
		}

		// Create HTML page with feedback table
		const html = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>PM Dashboard - Customer Feedback</title>
	<style>
		body {
			font-family: Arial, sans-serif;
			max-width: 900px;
			margin: 50px auto;
			padding: 20px;
			background-color: #f5f5f5;
		}
		h1 {
			color: #404041;
			text-align: center;
		}
		h3 {
			color: #404041;
		}
		.summary {
			background-color: white;
			padding: 20px;
			margin-bottom: 20px;
			border-radius: 5px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		.summary h2 {
			margin-top: 0;
			color: #404041;
		}
		.summary p {
			margin: 8px 0;
			font-size: 16px;
		}
		.metrics {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 15px;
			margin-bottom: 20px;
		}
		.metric-card {
			background-color: #f8f9fa;
			padding: 15px;
			border-radius: 5px;
			text-align: center;
		}
		.metric-value {
			font-size: 32px;
			font-weight: bold;
			color: #404041;
		}
		.metric-label {
			font-size: 14px;
			color: #404041;
			margin-top: 5px;
		}
		.chart {
			margin-top: 20px;
		}
		.chart-item {
			margin-bottom: 15px;
		}
		.chart-label {
			display: flex;
			justify-content: space-between;
			margin-bottom: 5px;
			font-size: 14px;
			color: #404041;
		}
		.chart-bar-container {
			width: 100%;
			height: 30px;
			background-color: #e0e0e0;
			border-radius: 15px;
			overflow: hidden;
		}
		.chart-bar {
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			color: white;
			font-weight: bold;
			font-size: 12px;
			transition: width 0.3s ease;
		}
		.chart-bar-positive {
			background-color: #F48120;
		}
		.chart-bar-neutral {
			background-color: #FAAD3F;
		}
		.chart-bar-negative {
			background-color: #404041;
		}
		table {
			width: 100%;
			border-collapse: collapse;
			background-color: white;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		th {
			background-color: #F48120;
			color: white;
			padding: 12px;
			text-align: left;
		}
		td {
			padding: 10px;
			border-bottom: 1px solid #ddd;
		}
		tr:hover {
			background-color: #f5f5f5;
		}
		.sentiment-positive {
			color: #F48120;
			font-weight: bold;
		}
		.sentiment-neutral {
			color: #FAAD3F;
			font-weight: bold;
		}
		.sentiment-negative {
			color: #404041;
			font-weight: bold;
		}
		.controls {
			background-color: white;
			padding: 20px;
			margin-bottom: 20px;
			border-radius: 5px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		.controls h3 {
			margin-top: 0;
			margin-bottom: 15px;
		}
		.control-group {
			margin-bottom: 15px;
		}
		.control-group label {
			display: block;
			margin-bottom: 8px;
			font-weight: bold;
			color: #404041;
		}
		.control-buttons {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
		}
		.btn {
			padding: 8px 16px;
			border: none;
			border-radius: 5px;
			cursor: pointer;
			font-size: 14px;
			font-weight: bold;
			transition: all 0.3s ease;
		}
		.btn:hover {
			opacity: 0.9;
			transform: translateY(-1px);
		}
		.btn-active {
			background-color: #F48120;
			color: white;
		}
		.btn-inactive {
			background-color: #e0e0e0;
			color: #404041;
		}
		.btn-inactive:hover {
			background-color: #FAAD3F;
			color: white;
		}
		.insights {
			background-color: white;
			padding: 20px;
			margin-bottom: 20px;
			border-radius: 5px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		.insights h2 {
			margin-top: 0;
			color: #404041;
			border-bottom: 2px solid #F48120;
			padding-bottom: 10px;
		}
		.insight-section {
			margin-bottom: 20px;
		}
		.insight-section h3 {
			color: #F48120;
			font-size: 18px;
			margin-bottom: 10px;
		}
		.insight-section p,
		.insight-section ul {
			color: #404041;
			line-height: 1.6;
			margin: 0;
		}
		.insight-section ul {
			padding-left: 20px;
		}
		.insight-section li {
			margin-bottom: 8px;
		}
		.insight-badge {
			display: inline-block;
			background-color: #FAAD3F;
			color: #404041;
			padding: 4px 8px;
			border-radius: 3px;
			font-size: 12px;
			font-weight: bold;
			margin-right: 8px;
		}
	</style>
</head>
<body>
	<h1>Customer Feedback Dashboard</h1>
	<div class="summary">
		<h2>Key Metrics</h2>
		<div class="metrics">
			<div class="metric-card">
				<div class="metric-value">${total}</div>
				<div class="metric-label">Total Feedback</div>
			</div>
			<div class="metric-card">
				<div class="metric-value" style="color: #F48120;">${positive}</div>
				<div class="metric-label">Positive</div>
			</div>
			<div class="metric-card">
				<div class="metric-value" style="color: #FAAD3F;">${neutral}</div>
				<div class="metric-label">Neutral</div>
			</div>
			<div class="metric-card">
				<div class="metric-value" style="color: #404041;">${negative}</div>
				<div class="metric-label">Negative</div>
			</div>
		</div>
		<div class="chart">
			<h3>Sentiment Distribution</h3>
			<div class="chart-item">
				<div class="chart-label">
					<span><strong>Positive</strong></span>
					<span>${positivePercent}%</span>
				</div>
				<div class="chart-bar-container">
					<div class="chart-bar chart-bar-positive" style="width: ${positivePercent}%;">${positivePercent}%</div>
				</div>
			</div>
			<div class="chart-item">
				<div class="chart-label">
					<span><strong>Neutral</strong></span>
					<span>${neutralPercent}%</span>
				</div>
				<div class="chart-bar-container">
					<div class="chart-bar chart-bar-neutral" style="width: ${neutralPercent}%;">${neutralPercent}%</div>
				</div>
			</div>
			<div class="chart-item">
				<div class="chart-label">
					<span><strong>Negative</strong></span>
					<span>${negativePercent}%</span>
				</div>
				<div class="chart-bar-container">
					<div class="chart-bar chart-bar-negative" style="width: ${negativePercent}%;">${negativePercent}%</div>
				</div>
			</div>
		</div>
	</div>
	<div class="insights">
		<h2>Key Insights</h2>
		${insightsHTML}
	</div>
	<div class="controls">
		<h3>Filter & Sort</h3>
		<div class="control-group">
			<label>Filter by Sentiment:</label>
			<div class="control-buttons">
				<button class="btn btn-active" onclick="filterBySentiment('all')">All</button>
				<button class="btn btn-inactive" onclick="filterBySentiment('positive')">Positive</button>
				<button class="btn btn-inactive" onclick="filterBySentiment('neutral')">Neutral</button>
				<button class="btn btn-inactive" onclick="filterBySentiment('negative')">Negative</button>
			</div>
		</div>
		<div class="control-group">
			<label>Sort by:</label>
			<div class="control-buttons">
				<button class="btn btn-inactive" onclick="sortBy('recent')">Most Recent</button>
				<button class="btn btn-inactive" onclick="sortBy('oldest')">Oldest</button>
				<button class="btn btn-inactive" onclick="sortBy('user')">User Name</button>
			</div>
		</div>
	</div>
	<table>
		<thead>
			<tr>
				<th>User</th>
				<th>Comment</th>
				<th>Source</th>
				<th>Sentiment</th>
			</tr>
		</thead>
		<tbody id="feedbackTableBody">
			${feedback.map(f => `
			<tr>
				<td>${f.user}</td>
				<td>${f.comment}</td>
				<td>${f.source}</td>
				<td class="sentiment-${f.sentiment}">${f.sentiment}</td>
			</tr>
			`).join('')}
		</tbody>
	</table>
	<script>
		// Embed feedback data
		const feedbackData = ${JSON.stringify(feedback)};
		let currentFilter = 'all';
		let currentSort = 'recent';

		// Initialize button states
		updateButtons('filter', 'all');
		updateButtons('sort', 'recent');

		function filterBySentiment(sentiment) {
			currentFilter = sentiment;
			updateButtons('filter', sentiment);
			renderTable();
		}

		function sortBy(sortType) {
			currentSort = sortType;
			updateButtons('sort', sortType);
			renderTable();
		}

		function updateButtons(type, activeValue) {
			if (type === 'filter') {
				const buttons = document.querySelectorAll('.control-group:first-child .btn');
				buttons.forEach(btn => {
					const text = btn.textContent.toLowerCase().trim();
					if ((text === 'all' && activeValue === 'all') ||
						(text === 'positive' && activeValue === 'positive') ||
						(text === 'neutral' && activeValue === 'neutral') ||
						(text === 'negative' && activeValue === 'negative')) {
						btn.className = 'btn btn-active';
					} else {
						btn.className = 'btn btn-inactive';
					}
				});
			} else {
				const buttons = document.querySelectorAll('.control-group:last-child .btn');
				buttons.forEach(btn => {
					const text = btn.textContent.toLowerCase().trim();
					if ((text === 'most recent' && activeValue === 'recent') ||
						(text === 'oldest' && activeValue === 'oldest') ||
						(text === 'user name' && activeValue === 'user')) {
						btn.className = 'btn btn-active';
					} else {
						btn.className = 'btn btn-inactive';
					}
				});
			}
		}

		function renderTable() {
			// Filter data
			let filtered = feedbackData;
			if (currentFilter !== 'all') {
				filtered = feedbackData.filter(f => f.sentiment === currentFilter);
			}

			// Sort data
			let sorted = [...filtered];
			if (currentSort === 'recent') {
				sorted.sort((a, b) => b.timestamp - a.timestamp);
			} else if (currentSort === 'oldest') {
				sorted.sort((a, b) => a.timestamp - b.timestamp);
			} else if (currentSort === 'user') {
				sorted.sort((a, b) => a.user.localeCompare(b.user));
			}

			// Render table
			const tbody = document.getElementById('feedbackTableBody');
			tbody.innerHTML = sorted.map(f => 
				'<tr>' +
					'<td>' + f.user + '</td>' +
					'<td>' + f.comment + '</td>' +
					'<td>' + f.source + '</td>' +
					'<td class="sentiment-' + f.sentiment + '">' + f.sentiment + '</td>' +
				'</tr>'
			).join('');
		}
	</script>
</body>
</html>
		`;

		return new Response(html, {
			headers: {
				"Content-Type": "text/html; charset=UTF-8"
			}
		});
	},
};
  