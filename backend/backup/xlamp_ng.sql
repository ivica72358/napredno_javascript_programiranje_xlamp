--
-- PostgreSQL database dump
--

\restrict KakTwSHXkOZSM8c8tMKa7mDrrzLYuFOEE37FjjmQfV8cqniS1dcHyI0yAU47Mll

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.uplinks DROP CONSTRAINT IF EXISTS "uplinks_lampId_fkey";
ALTER TABLE IF EXISTS ONLY public.lamps DROP CONSTRAINT IF EXISTS "lamps_ownerId_fkey";
ALTER TABLE IF EXISTS ONLY public.downlinks DROP CONSTRAINT IF EXISTS "downlinks_lampId_fkey";
ALTER TABLE IF EXISTS ONLY public.downlinks DROP CONSTRAINT IF EXISTS "downlinks_createdById_fkey";
DROP INDEX IF EXISTS public.users_username_key;
DROP INDEX IF EXISTS public.users_email_key;
DROP INDEX IF EXISTS public."uplinks_lampId_receivedAt_idx";
DROP INDEX IF EXISTS public.lamps_status_idx;
DROP INDEX IF EXISTS public."lamps_ownerId_idx";
DROP INDEX IF EXISTS public."lamps_devEui_key";
DROP INDEX IF EXISTS public."downlinks_lampId_createdAt_idx";
DROP INDEX IF EXISTS public."downlinks_isSent_cancelled_idx";
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.uplinks DROP CONSTRAINT IF EXISTS uplinks_pkey;
ALTER TABLE IF EXISTS ONLY public.lamps DROP CONSTRAINT IF EXISTS lamps_pkey;
ALTER TABLE IF EXISTS ONLY public.downlinks DROP CONSTRAINT IF EXISTS downlinks_pkey;
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.uplinks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.lamps ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.downlinks ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.uplinks_id_seq;
DROP TABLE IF EXISTS public.uplinks;
DROP SEQUENCE IF EXISTS public.lamps_id_seq;
DROP TABLE IF EXISTS public.lamps;
DROP SEQUENCE IF EXISTS public.downlinks_id_seq;
DROP TABLE IF EXISTS public.downlinks;
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TYPE IF EXISTS public."Role";
DROP TYPE IF EXISTS public."LampStatus";
DROP TYPE IF EXISTS public."CommandType";
--
-- Name: CommandType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CommandType" AS ENUM (
    'TURN_ON',
    'TURN_OFF',
    'SET_BRIGHTNESS',
    'REQUEST_STATUS',
    'REQUEST_ENERGY'
);


--
-- Name: LampStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LampStatus" AS ENUM (
    'UNKNOWN',
    'ONLINE',
    'OFFLINE',
    'ERROR'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'USER',
    'ADMIN'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: downlinks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.downlinks (
    id integer NOT NULL,
    "lampId" integer NOT NULL,
    command public."CommandType" NOT NULL,
    argument integer,
    payload character varying(512) NOT NULL,
    port integer NOT NULL,
    "isSent" boolean DEFAULT false NOT NULL,
    "sentAt" timestamp(3) without time zone,
    error text,
    cancelled boolean DEFAULT false NOT NULL,
    "cancelledAt" timestamp(3) without time zone,
    "createdById" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: downlinks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.downlinks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: downlinks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.downlinks_id_seq OWNED BY public.downlinks.id;


--
-- Name: lamps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lamps (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    "devEui" character varying(16) NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    "currentBrightness" integer,
    status public."LampStatus" DEFAULT 'UNKNOWN'::public."LampStatus" NOT NULL,
    "lastSeen" timestamp(3) without time zone,
    "ownerId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: lamps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lamps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lamps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lamps_id_seq OWNED BY public.lamps.id;


--
-- Name: uplinks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uplinks (
    id integer NOT NULL,
    "lampId" integer NOT NULL,
    payload character varying(512) NOT NULL,
    port integer,
    rssi integer,
    snr double precision,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: uplinks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.uplinks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: uplinks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.uplinks_id_seq OWNED BY public.uplinks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(150) NOT NULL,
    password character varying(60) NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: downlinks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downlinks ALTER COLUMN id SET DEFAULT nextval('public.downlinks_id_seq'::regclass);


--
-- Name: lamps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lamps ALTER COLUMN id SET DEFAULT nextval('public.lamps_id_seq'::regclass);


--
-- Name: uplinks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uplinks ALTER COLUMN id SET DEFAULT nextval('public.uplinks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
09d5aa1c-d63e-405b-b1f6-1924e19f6fcd	9c906cf60904b26cba396615a3fc32dc9a8172f145f09aa1f67742880898ead4	2026-08-31 06:15:35.360465+00	20260817190356_init	\N	\N	2026-08-31 06:15:35.337325+00	1
3cdbe3a2-ccee-4c95-9810-30939d41760f	7db807e799fa2afc40242d754ca3322c553c0ab29503000d3584eb59c8cce942	2026-08-31 06:15:35.366577+00	20260817192912_naredbe_status_energija	\N	\N	2026-08-31 06:15:35.361899+00	1
\.


--
-- Data for Name: downlinks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.downlinks (id, "lampId", command, argument, payload, port, "isSent", "sentAt", error, cancelled, "cancelledAt", "createdById", "createdAt") FROM stdin;
1	3	TURN_ON	\N	03	10	f	\N	\N	f	\N	1	2026-08-31 06:58:39.95
2	1	REQUEST_STATUS	\N	01	30	t	2026-08-31 07:00:05.61	\N	f	\N	2	2026-08-31 07:00:05.571
3	3	TURN_ON	\N	03	10	t	2026-08-31 07:05:36.139	\N	f	\N	1	2026-08-31 07:05:36.092
4	3	TURN_OFF	\N	02	10	t	2026-08-31 07:20:51.529	\N	f	\N	1	2026-08-31 07:20:51.493
5	3	TURN_ON	\N	03	10	t	2026-08-31 07:23:51.636	\N	f	\N	1	2026-08-31 07:23:51.601
6	3	REQUEST_STATUS	\N	01	30	t	2026-08-31 07:27:08.802	\N	f	\N	1	2026-08-31 07:27:08.758
7	2	REQUEST_STATUS	\N	01	30	t	2026-08-31 07:40:55.178	\N	f	\N	1	2026-08-31 07:40:55.144
8	2	TURN_ON	\N	03	10	t	2026-08-31 07:42:45.678	\N	f	\N	1	2026-08-31 07:42:45.646
9	2	TURN_OFF	\N	02	10	t	2026-08-31 07:43:02.442	\N	f	\N	1	2026-08-31 07:43:02.409
10	2	SET_BRIGHTNESS	100	01fe	10	t	2026-08-31 07:43:17.84	\N	f	\N	1	2026-08-31 07:43:17.806
11	2	TURN_OFF	\N	02	10	t	2026-08-31 07:43:33.995	\N	f	\N	1	2026-08-31 07:43:33.963
13	1	REQUEST_ENERGY	\N	02	30	t	2026-08-31 08:35:47.976	\N	f	\N	1	2026-08-31 08:35:47.938
14	3	REQUEST_STATUS	\N	01	30	t	2026-08-31 16:09:10.202	\N	f	\N	2	2026-08-31 16:09:10.166
15	3	REQUEST_STATUS	\N	01	30	t	2026-08-31 16:09:17.978	\N	f	\N	2	2026-08-31 16:09:17.945
16	3	SET_BRIGHTNESS	100	01fe	10	t	2026-08-31 16:09:33.178	\N	f	\N	2	2026-08-31 16:09:33.145
\.


--
-- Data for Name: lamps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lamps (id, name, "devEui", latitude, longitude, "currentBrightness", status, "lastSeen", "ownerId", "createdAt", "updatedAt") FROM stdin;
3	Avenija Veceslava Holjevca	8cf95720001e292d	45.79051	15.979572	100	ONLINE	2026-08-31 18:24:26.846	2	2026-08-31 06:16:59.929	2026-08-31 18:24:26.848
2	Obala trnjanskih branitelja	8cf95720001e3845	45.790524	15.981706	0	ONLINE	2026-08-31 18:41:51.035	2	2026-08-31 06:16:59.927	2026-08-31 18:41:51.04
1	Trnjanski nasip	8cf95720001e223d	45.790839	15.980698	18	ONLINE	2026-08-31 18:45:21.253	2	2026-08-31 06:16:59.919	2026-08-31 18:45:21.257
\.


--
-- Data for Name: uplinks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.uplinks (id, "lampId", payload, port, rssi, snr, "receivedAt") FROM stdin;
1	2	04030002000000090000a8c00401cb	31	-48	9.75	2026-08-31 06:24:41.824
2	2	016a951e2b0000015c320e	31	-49	9.5	2026-08-31 06:24:50.642
3	1	04030002000000090000a8c00401cb	31	-42	9.25	2026-08-31 06:25:25.75
4	3	04030002000000090000a8c00401cb	31	-47	9.25	2026-08-31 06:25:35.25
5	1	016a951e5a0000015f2d05	31	-43	8.75	2026-08-31 06:25:36.999
6	3	016a951e610000015d310e	31	-51	10.5	2026-08-31 06:25:44.07
7	1	016a9526740000015d2e04	31	-47	9.75	2026-08-31 07:00:10.698
8	3	016a9527bf042f015c3004	31	-53	11	2026-08-31 07:05:42.023
9	2	016a9528150000015b3204	31	-57	9	2026-08-31 07:07:08.244
10	1	016a95285b0000015d2e04	31	-47	8.25	2026-08-31 07:08:18.486
11	3	026a9528610088045547ff094f	31	-55	11	2026-08-31 07:08:25.572
12	1	016a9528b7042f015d3004	31	-47	10	2026-08-31 07:09:50.263
13	1	026a9528cf008808872eff095a	31	-49	9.75	2026-08-31 07:10:14.913
14	2	026a95294d00880e82e7ff094f	31	-57	8	2026-08-31 07:12:22.119
15	2	016a9529710000015b3504	31	-58	7.25	2026-08-31 07:12:56.329
16	3	016a952973042f01663104	31	-55	7.25	2026-08-31 07:12:58.592
17	2	016a9529cc041e015b3404	31	-63	10	2026-08-31 07:14:28.085
18	3	016a952b520000016a2f04	31	-57	8.75	2026-08-31 07:20:57.147
19	3	016a952c06042f01642f04	31	-55	9	2026-08-31 07:23:56.967
20	3	016a952ccb042f01692e05	31	-57	6.75	2026-08-31 07:27:13.814
21	2	016a952d4e041e016b370e	31	-61	10	2026-08-31 07:29:25.709
22	2	016a953005041e016f3304	31	-63	8.75	2026-08-31 07:41:00.855
23	2	016a95307504cb016f3504	31	-66	8.5	2026-08-31 07:42:52.562
24	2	016a9530840000016f3504	31	-64	9.75	2026-08-31 07:43:07.51
25	2	016a95309304fe016e3604	31	-66	8.75	2026-08-31 07:43:22.469
26	2	016a9530a30000016e3605	31	-61	8	2026-08-31 07:43:38.433
27	3	026a9532eb0088045573ff0966	31	-57	8.25	2026-08-31 07:53:23.115
28	1	016a9533b4042f01722e0e	31	-55	9.75	2026-08-31 07:56:43.346
29	1	026a9533cc008808875fff095e	31	-58	9.75	2026-08-31 07:57:07.975
30	2	016a95342400000163360f	31	-63	9.5	2026-08-31 07:58:36.078
31	2	026a9534c200880e831dff0935	31	-65	6.75	2026-08-31 08:01:14.374
32	3	016a953754042f01702e0d	31	-55	10	2026-08-31 08:12:11.414
33	2	016a9537a600000160360f	31	-63	11.25	2026-08-31 08:13:33.638
34	2	016a953b280000015e360f	31	-65	9.5	2026-08-31 08:28:31.293
35	1	026a953ce20088088788ff095b	31	-60	9	2026-08-31 08:35:54.17
36	3	026a953d7400880455a1ff0969	31	-56	9.5	2026-08-31 08:38:20.644
37	2	016a953ea90000015d360f	31	-60	10	2026-08-31 08:43:28.873
38	1	016a953eb1042f01743b04	31	-61	10.75	2026-08-31 08:43:36.276
39	2	026a95403600880e8323ff093c	31	-61	11	2026-08-31 08:50:06.49
40	3	016a9541de042f01712e0d	31	-58	8.5	2026-08-31 08:57:08.92
41	2	016a95422b0000015d360f	31	-59	9	2026-08-31 08:58:26.394
42	2	016a9545ac0000015d320d	31	-64	9	2026-08-31 09:13:24.02
43	1	026a9547df00880887b9ff0961	31	-60	7.75	2026-08-31 09:22:47.09
44	3	026a9547fe00880455d0ff0955	31	-58	9.25	2026-08-31 09:23:18.085
45	2	016a95492e0000015c320d	31	-61	11	2026-08-31 09:28:21.591
46	1	016a9549ae042f01753b04	31	-64	9.75	2026-08-31 09:30:29.179
47	2	026a954baa00880e8329ff0949	31	-63	9	2026-08-31 09:38:58.605
48	3	016a954c67042f01712e0d	31	-63	8.75	2026-08-31 09:42:06.271
49	2	016a954caf0000015c320d	31	-63	9	2026-08-31 09:43:19.136
50	2	016a9550310000015c320d	31	-61	8	2026-08-31 09:58:16.671
51	3	026a95528700880455feff0953	31	-59	9	2026-08-31 10:08:15.232
52	1	026a9552dc00880887ebff095f	31	-66	10	2026-08-31 10:09:39.927
53	2	016a9553b20000015c320d	31	-63	8.5	2026-08-31 10:13:14.205
54	1	016a9554ab042f01753b04	31	-67	9	2026-08-31 10:17:22.038
55	3	016a9556f0042f01722e0d	31	-60	7.75	2026-08-31 10:27:03.222
56	2	026a95571e00880e832fff0947	31	-64	9.75	2026-08-31 10:27:50.537
57	2	016a9557340000015c360e	31	-65	7.5	2026-08-31 10:28:11.783
58	2	016a955ab60000015c360e	31	-65	10	2026-08-31 10:43:09.336
59	3	026a955d0f008804562dff0963	31	-65	9.75	2026-08-31 10:53:12.008
60	1	026a955dd9008808881cff0955	31	-61	10	2026-08-31 10:56:32.911
61	2	016a955e370000015c360e	31	-65	10.75	2026-08-31 10:58:07
62	1	016a955fa8042f01753b04	31	-61	8.25	2026-08-31 11:04:15.019
63	3	016a956178042f0172310d	31	-60	9.5	2026-08-31 11:11:59.855
64	2	016a9561b90000015c360e	31	-65	9.75	2026-08-31 11:13:04.586
65	2	026a95629200880e8334ff0939	31	-63	7.75	2026-08-31 11:16:42.668
66	2	016a95653a0000015c360e	31	-64	10.5	2026-08-31 11:28:02.186
67	3	026a956798008804565bff0940	31	-61	8	2026-08-31 11:38:08.486
68	2	016a9568bc0000015c360e	31	-63	9.25	2026-08-31 11:42:59.715
69	1	026a9568d6008808884dff094c	31	-62	7.75	2026-08-31 11:43:25.68
70	1	016a956aa5042f01753b04	31	-63	11	2026-08-31 11:51:07.748
71	3	016a956c00042f0172310d	31	-59	9.5	2026-08-31 11:56:56.187
72	2	016a956c3d0000015c360e	31	-63	8.75	2026-08-31 11:57:57.264
73	2	026a956e0600880e833aff0956	31	-65	10	2026-08-31 12:05:34.78
74	2	016a956fbf0000015c360e	31	-64	9.25	2026-08-31 12:12:54.914
75	3	026a9572200088045689ff0952	31	-61	10	2026-08-31 12:23:04.627
76	2	016a9573410000015c360e	31	-63	7.5	2026-08-31 12:27:52.423
77	1	026a9573d2008808887fff094e	31	-67	7.75	2026-08-31 12:30:18.509
78	1	016a9575a2042f0175370d	31	-64	10.5	2026-08-31 12:38:00.571
79	3	016a957689042f0172310d	31	-60	8	2026-08-31 12:41:52.367
80	2	016a9576c20000015c360e	31	-63	7	2026-08-31 12:42:50.105
81	2	026a95797a00880e8340ff0941	31	-64	9.75	2026-08-31 12:54:27.039
82	2	016a957a440000015c360e	31	-60	8.75	2026-08-31 12:57:47.778
83	3	026a957ca800880456b8ff094d	31	-60	7.25	2026-08-31 13:08:00.946
84	2	016a957dc60000015c360e	31	-63	9.5	2026-08-31 13:12:45.413
85	1	026a957ecf00880888b0ff0953	31	-65	9.5	2026-08-31 13:17:11.355
86	1	016a95809f042f0176370d	31	-63	7.75	2026-08-31 13:24:53.505
87	3	016a958111042f0172310d	31	-60	7	2026-08-31 13:26:48.68
88	2	016a9581470000015c360e	31	-64	8.75	2026-08-31 13:27:43.009
89	2	016a9584c90000015c360e	31	-65	9.75	2026-08-31 13:42:40.618
90	2	026a9584ee00880e8345ff0932	31	-65	10	2026-08-31 13:43:19.215
91	3	026a95873000880456e6ff0939	31	-61	11	2026-08-31 13:52:57.167
92	2	016a95884a0000015c360e	31	-63	7.25	2026-08-31 13:57:38.252
93	1	026a9589cc00880888e2ff0958	31	-63	10.5	2026-08-31 14:04:04.259
94	3	016a958b99042f0172310d	31	-61	9.25	2026-08-31 14:11:44.862
95	1	016a958b9b042f0176370d	31	-65	6.5	2026-08-31 14:11:46.298
96	2	016a958bcc0000015c360f	31	-62	9	2026-08-31 14:12:35.915
97	2	016a958f4e0000015c360f	31	-62	9.5	2026-08-31 14:27:33.405
98	2	026a95906300880e834bff0940	31	-63	10.5	2026-08-31 14:32:11.348
99	3	026a9591b80088045715ff094b	31	-60	9	2026-08-31 14:37:53.384
100	2	016a9592cf0000015c360f	31	-64	9.5	2026-08-31 14:42:30.935
101	1	026a9594c90088088913ff0956	31	-69	8.75	2026-08-31 14:50:56.811
102	3	016a959621042f0172310e	31	-61	9.5	2026-08-31 14:56:41.157
103	2	016a9596510000015c360f	31	-62	9.5	2026-08-31 14:57:28.518
104	1	016a959698042f0176370d	31	-61	9	2026-08-31 14:58:38.94
105	2	016a9599d20000015c360f	31	-63	8	2026-08-31 15:12:25.965
106	2	026a959bd600880e8351ff0946	31	-65	10.75	2026-08-31 15:21:03.227
107	3	026a959c410088045743ff0962	31	-60	10	2026-08-31 15:22:49.631
108	2	016a959d540000015c350e	31	-63	9.25	2026-08-31 15:27:23.463
109	1	026a959fc60088088944ff095f	31	-64	9.5	2026-08-31 15:37:49.649
110	3	016a95a0a9042f0172310e	31	-61	9.75	2026-08-31 15:41:37.396
111	2	016a95a0d50000015c350e	31	-65	10	2026-08-31 15:42:20.957
112	1	016a95a195042f0176370d	31	-67	7.5	2026-08-31 15:45:31.78
113	2	016a95a4570000015c350e	31	-63	7.75	2026-08-31 15:57:18.465
114	3	026a95a6c90088045771ff0968	31	-59	9.5	2026-08-31 16:07:45.979
115	3	016a95a723042f01723104	31	-61	9.75	2026-08-31 16:09:15.174
116	3	016a95a72e042f01723104	31	-61	9.5	2026-08-31 16:09:26.124
117	3	016a95a73a04fe01723204	31	-61	7.25	2026-08-31 16:09:38.116
118	2	026a95a74a00880e8357ff0940	31	-61	8.75	2026-08-31 16:09:55.03
119	2	016a95a7d80000015c350e	31	-65	10.25	2026-08-31 16:12:15.935
120	1	026a95aac30088088976ff094f	31	-64	11.25	2026-08-31 16:24:42.601
121	2	016a95ab5a0000015c350e	31	-61	9.75	2026-08-31 16:27:13.508
122	1	016a95ac92042f01763d0d	31	-64	9.25	2026-08-31 16:32:24.711
123	2	016a95aedb0000015c350e	31	-65	9.75	2026-08-31 16:42:11
124	3	026a95b151008804580bff0949	31	-60	9.5	2026-08-31 16:52:42.313
125	3	016a95b1c204fe0175310e	31	-57	9.75	2026-08-31 16:54:34.428
126	2	016a95b25d0000015c350e	31	-65	8.25	2026-08-31 16:57:08.516
127	2	026a95b2be00880e835cff093c	31	-60	10	2026-08-31 16:58:46.947
128	1	026a95b5bf00880889a7ff0954	31	-63	6.5	2026-08-31 17:11:35.48
129	2	016a95b5de0000015c350e	31	-63	8	2026-08-31 17:12:05.923
130	1	016a95b78f042f01763d0d	31	-63	8	2026-08-31 17:19:17.599
131	2	016a95b9600000015c350e	31	-61	8	2026-08-31 17:27:03.4
132	3	026a95bbd900880458a9ff094f	31	-60	7.25	2026-08-31 17:37:38.552
133	3	016a95bc4a04fe0177310e	31	-57	8.75	2026-08-31 17:39:30.653
134	2	016a95bce10000015c350e	31	-65	10.25	2026-08-31 17:42:00.895
135	2	026a95be3200880e8362ff0940	31	-63	10	2026-08-31 17:47:38.671
136	2	016a95c0630000015c340e	31	-64	9.5	2026-08-31 17:56:58.373
137	1	026a95c0bc00880889d9ff094e	31	-63	10.5	2026-08-31 17:58:28.367
138	1	016a95c28c042f01763d0d	31	-63	11.25	2026-08-31 18:06:10.506
139	2	016a95c3e40000015c340e	31	-63	9	2026-08-31 18:11:55.95
140	3	026a95c6610088045947ff094e	31	-61	10.5	2026-08-31 18:22:34.754
141	3	016a95c6d304fe0178310e	31	-59	10	2026-08-31 18:24:26.846
142	2	016a95c7660000015c340e	31	-65	10.25	2026-08-31 18:26:53.485
143	2	026a95c9a600880e8368ff094d	31	-61	9.5	2026-08-31 18:36:30.635
144	2	016a95cae70000015c340e	31	-60	8	2026-08-31 18:41:51.035
145	1	026a95cbb90088088a0aff095f	31	-67	10.75	2026-08-31 18:45:21.253
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, email, password, role, "createdAt", "updatedAt") FROM stdin;
1	admin	admin@x-logic.net	$2a$10$Aor4sk.I1v1qiz0bYLCPRO2M0riDFSqDS8cZOkEs/usjQwCMJpjWa	ADMIN	2026-08-31 06:16:59.864	2026-08-31 09:26:07.188
2	ivica	ivica.srdojevic@x-logic.net	$2a$10$Aor4sk.I1v1qiz0bYLCPRO2M0riDFSqDS8cZOkEs/usjQwCMJpjWa	USER	2026-08-31 06:16:59.916	2026-08-31 09:26:07.282
\.


--
-- Name: downlinks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.downlinks_id_seq', 16, true);


--
-- Name: lamps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lamps_id_seq', 4, true);


--
-- Name: uplinks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.uplinks_id_seq', 145, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: downlinks downlinks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downlinks
    ADD CONSTRAINT downlinks_pkey PRIMARY KEY (id);


--
-- Name: lamps lamps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lamps
    ADD CONSTRAINT lamps_pkey PRIMARY KEY (id);


--
-- Name: uplinks uplinks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uplinks
    ADD CONSTRAINT uplinks_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: downlinks_isSent_cancelled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "downlinks_isSent_cancelled_idx" ON public.downlinks USING btree ("isSent", cancelled);


--
-- Name: downlinks_lampId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "downlinks_lampId_createdAt_idx" ON public.downlinks USING btree ("lampId", "createdAt" DESC);


--
-- Name: lamps_devEui_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "lamps_devEui_key" ON public.lamps USING btree ("devEui");


--
-- Name: lamps_ownerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lamps_ownerId_idx" ON public.lamps USING btree ("ownerId");


--
-- Name: lamps_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lamps_status_idx ON public.lamps USING btree (status);


--
-- Name: uplinks_lampId_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "uplinks_lampId_receivedAt_idx" ON public.uplinks USING btree ("lampId", "receivedAt" DESC);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: downlinks downlinks_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downlinks
    ADD CONSTRAINT "downlinks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: downlinks downlinks_lampId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downlinks
    ADD CONSTRAINT "downlinks_lampId_fkey" FOREIGN KEY ("lampId") REFERENCES public.lamps(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: lamps lamps_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lamps
    ADD CONSTRAINT "lamps_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: uplinks uplinks_lampId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uplinks
    ADD CONSTRAINT "uplinks_lampId_fkey" FOREIGN KEY ("lampId") REFERENCES public.lamps(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict KakTwSHXkOZSM8c8tMKa7mDrrzLYuFOEE37FjjmQfV8cqniS1dcHyI0yAU47Mll

