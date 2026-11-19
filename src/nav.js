// Sticky section navigation: marks the current section and shows scroll progress.

export function initSectionNav() {
	const links = [...document.querySelectorAll("#sectionNav a[data-section]")];
	const sections = links
		.map((link) => document.getElementById(link.dataset.section))
		.filter(Boolean);
	const progress = document.getElementById("navProgress");
	if (!sections.length) return;

	const update = () => {
		const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
		progress.style.width = maxScroll > 0 ? `${(window.scrollY / maxScroll) * 100}%` : "0%";

		let current = sections[0];
		for (const section of sections) {
			if (section.getBoundingClientRect().top <= 140) current = section;
		}
		if (maxScroll <= 0 || window.scrollY >= maxScroll - 2) current = sections[sections.length - 1];
		for (const link of links) {
			if (link.dataset.section === current.id) link.setAttribute("aria-current", "location");
			else link.removeAttribute("aria-current");
		}
	};
	window.addEventListener("scroll", update, { passive: true });
	window.addEventListener("resize", update);
	window.addEventListener("hashchange", update);
	// Page height grows when the table and charts render, so keep progress fresh.
	if ("ResizeObserver" in window) new ResizeObserver(update).observe(document.body);
	update();
}
