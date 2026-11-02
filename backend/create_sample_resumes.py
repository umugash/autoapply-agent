import os
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def create_resume_pdf(filename: str, title: str, summary: str, skills: list, experiences: list):
    output_dir = Path(__file__).resolve().parent / "data" / "resumes"
    output_dir.mkdir(parents=True, exist_ok=True)
    filepath = output_dir / filename

    doc = SimpleDocTemplate(
        str(filepath),
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )

    styles = getSampleStyleSheet()
    
    header_style = ParagraphStyle(
        'HeaderName',
        parent=styles['Heading1'],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'HeaderTitle',
        parent=styles['Normal'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#2563eb'),
        fontName='Helvetica-Bold'
    )
    
    contact_style = ParagraphStyle(
        'ContactText',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#64748b')
    )
    
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1e293b'),
        fontName='Helvetica-Bold',
        spaceBefore=10,
        spaceAfter=4
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#334155')
    )

    story = []
    
    # Header
    story.append(Paragraph("Alex Morgan", header_style))
    story.append(Paragraph(title, subtitle_style))
    story.append(Paragraph("San Francisco, CA &nbsp;|&nbsp; alex.morgan.dev@example.com &nbsp;|&nbsp; +1 (555) 234-5678 &nbsp;|&nbsp; linkedin.com/in/alexmorgan-dev &nbsp;|&nbsp; github.com/alexmorgan-code", contact_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563eb'), spaceBefore=2, spaceAfter=8))
    
    # Summary
    story.append(Paragraph("PROFESSIONAL SUMMARY", section_style))
    story.append(Paragraph(summary, body_style))
    story.append(Spacer(1, 6))
    
    # Skills
    story.append(Paragraph("CORE SKILLS & TECHNOLOGIES", section_style))
    skills_text = " &bull; ".join(skills)
    story.append(Paragraph(skills_text, body_style))
    story.append(Spacer(1, 6))

    # Experience
    story.append(Paragraph("WORK EXPERIENCE", section_style))
    for exp in experiences:
        role_company = f"<b>{exp['role']}</b> &nbsp;|&nbsp; {exp['company']} &nbsp;<i>({exp['dates']})</i>"
        story.append(Paragraph(role_company, body_style))
        story.append(Paragraph(exp['bullets'], body_style))
        story.append(Spacer(1, 4))
        
    # Education
    story.append(Paragraph("EDUCATION", section_style))
    edu_text = "<b>Bachelor of Science in Computer Science</b> &nbsp;|&nbsp; UC Berkeley (2018 - 2022) &nbsp;|&nbsp; GPA: 3.8/4.0"
    story.append(Paragraph(edu_text, body_style))

    doc.build(story)
    print(f"Generated: {filepath}")

def generate_all():
    # 1. Backend Engineer
    create_resume_pdf(
        filename="Alex_Morgan_Backend_Engineer.pdf",
        title="Senior Backend Systems Engineer",
        summary="High-performance backend architect specializing in Python FastAPI, Go microservices, and distributed streaming pipelines handling 50M+ events/day. Proven track record of reducing latency, optimizing database transactions, and cloud orchestration.",
        skills=["Python", "FastAPI", "Go", "PostgreSQL", "Kafka", "Docker", "Kubernetes", "AWS", "Redis", "Microservices", "gRPC", "CI/CD"],
        experiences=[
            {
                "role": "Software Engineer II (Backend)",
                "company": "Apex Cloud Systems",
                "dates": "06/2022 - Present",
                "bullets": "&bull; Engineered distributed event ingestion pipeline processing 50M+ events/day using FastAPI, Kafka, and PostgreSQL.<br/>&bull; Reduced P99 API response latency by 65% through Redis multi-tier caching and query optimization.<br/>&bull; Spearheaded Docker containerization and Kubernetes Helm chart automation for 14 microservices."
            },
            {
                "role": "Backend Engineering Intern",
                "company": "NextGen Systems",
                "dates": "05/2021 - 08/2021",
                "bullets": "&bull; Developed RESTful microservices in Python for tenant onboarding and automated billing workflows.<br/>&bull; Implemented asynchronous background workers using Celery and Redis to handle batch data export jobs."
            }
        ]
    )

    # 2. AI / ML Engineer
    create_resume_pdf(
        filename="Alex_Morgan_AI_ML_Engineer.pdf",
        title="AI / Machine Learning Engineer",
        summary="Machine Learning engineer focused on production LLM agents, retrieval-augmented generation (RAG), model quantization, fine-tuning, and scalable PyTorch inference pipelines with low latency.",
        skills=["PyTorch", "Python", "Transformers", "LLMs", "RAG", "LangChain", "Vector DBs (Pinecone/Milvus)", "FastAPI", "MLOps", "Computer Vision"],
        experiences=[
            {
                "role": "AI Engineer (RAG & Agents)",
                "company": "Apex AI Research",
                "dates": "06/2022 - Present",
                "bullets": "&bull; Built and deployed multi-agent RAG workflow with vector search serving 500k queries/month.<br/>&bull; Fine-tuned open-source LLMs (Llama-3, Mistral) with LoRA/QLoRA for domain-specific contract extraction with 96% accuracy.<br/>&bull; Optimized PyTorch model inference using TensorRT and ONNX, reducing latency by 45% on NVIDIA GPUs."
            },
            {
                "role": "Computer Vision & ML Intern",
                "company": "NextGen AI Labs",
                "dates": "05/2021 - 08/2021",
                "bullets": "&bull; Trained CNN and Vision Transformer models for automated defect detection with 98.2% mAP.<br/>&bull; Built data augmentation and automated labeling pipeline using active learning."
            }
        ]
    )

    # 3. Fullstack Engineer
    create_resume_pdf(
        filename="Alex_Morgan_Fullstack_Engineer.pdf",
        title="Full Stack Software Engineer",
        summary="Product-minded Full Stack Engineer crafting fluid, accessible user experiences in React / Next.js paired with robust, maintainable backend APIs in Node.js and Python.",
        skills=["React", "TypeScript", "Next.js", "Python", "FastAPI", "Node.js", "TailwindCSS", "PostgreSQL", "REST/GraphQL", "Jest", "Git"],
        experiences=[
            {
                "role": "Full Stack Engineer",
                "company": "Apex Cloud Systems",
                "dates": "06/2022 - Present",
                "bullets": "&bull; Led frontend redesign of flagship SaaS analytics dashboard using React 18, TypeScript, and TailwindCSS.<br/>&bull; Built full-stack collaborative real-time editor using WebSockets and PostgreSQL.<br/>&bull; Increased core web vitals score from 62 to 94 through code splitting, image optimization, and server-side rendering."
            },
            {
                "role": "Frontend Engineering Intern",
                "company": "NextGen Web Labs",
                "dates": "05/2021 - 08/2021",
                "bullets": "&bull; Developed reusable component library in React/TypeScript with 100% Storybook test coverage.<br/>&bull; Integrated OAuth2 authentication and user management flows with Auth0."
            }
        ]
    )

if __name__ == "__main__":
    generate_all()
