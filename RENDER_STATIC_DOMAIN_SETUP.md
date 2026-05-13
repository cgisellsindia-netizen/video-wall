Camigo split deployment plan

Services
- `camigo-store`: backend API web service
- `camigo-web`: frontend static site

Why this setup
- removes the Render cold-start/init page from the public homepage
- keeps the frontend on Render's CDN as a true static site
- leaves the API on the existing backend service
- improves SEO and link previews because the homepage is no longer fronted by a sleeping web service

Render steps
1. In Render, sync the Blueprint from `render.yaml`.
2. Let Render update `camigo-store` as the backend-only service.
3. Let Render create the new static site `camigo-web`.
4. After the static site deploys, open it and confirm it loads the Camigo homepage.
5. Keep `REACT_APP_API_URL` on the static site pointing to `https://camigo-store.onrender.com/api`.

Custom domain steps
1. Attach your public domain to the static site, not the backend service.
2. Recommended primary domain:
   - `getcamigo.com`
3. Recommended redirect/secondary domains:
   - `www.getcamigo.com`
   - `getcamigo.in`
   - `www.getcamigo.in`
4. In the Render domain settings for the static site, copy the DNS records Render gives you.
5. In GoDaddy, add exactly those DNS records for the chosen domain.
6. Wait for Render verification to turn green.

Backend domain note
- The backend can continue to stay on `https://camigo-store.onrender.com/api`.
- The frontend static site will call that API endpoint directly.

After domain cutover
- Set the old Render web-service root URL aside for API use only.
- Use the custom domain as the marketing/public website.
