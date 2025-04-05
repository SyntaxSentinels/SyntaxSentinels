<!-- <Please keep the folder structure as given in the template repo.  We will
discuss each artifact as we get to it in the course.  In some cases, like for
the SRS, you should have a file of the same name.  For other cases, like the
design documentation, you are required to document your design, but it may not
be via a module guide and module interface specification documents.>

<The files and folders have been set-up with tex files that have external links
so that cross-referencing is possible between documents.>

<The tex files Common.tex so that they can share definitions.>

<The files use Comments.tex so that the comments package can be used to embed
comments into the generated pdf.  Comments can be set to false so that they do
not appear.>

<None of the files are complete templates.  You will need to add extra
information.  They are just intended to be a starting point.>

<You should select an SRS template.  Three options are available in the repo, or
you can introduce another template. You should delete any SRS options that you do
not need. The folder SRS holds a template for Scientific Computing software;
the folder SRS-Volere holds the Volere template in LaTeX; the folder SRS-Meyer holds
the template that Dr. Mosser now uses in the third year requirements course.>

<The Makefile assumes the SRS will be in a folder called SRS.  If you use the Makefile
with a template other than the Scientific Computing template, you will have to delete
the unnecessary folders and rename your folder to SRS.> -->
# Documentation folders

The folders and files for this folder are as follows:

- Design: Describes the software architecture and detailed design (breaks down the software into modules) of the project.
- DevelopmentPlan: Describes the development plan for the software during the course of the project.
- HazardAnalysis: Identifies and analyzes potential hazards and mitigations for the project.
- Presentations: Contains all necessary supplemental files for the demonstrations that take place during the project, if applicable.
- ProblemStatementAndGoals: Describes the problem statement and goals for the project.
- projMngmnt: Logs metrics and progress of the project on a team level for key milestones during the course of the project.
- ReflectAndTrace: Contains a reflection by the team members on the project about how the team responded to feedback.
- SRS: Describes the software requirements for the project.
- UserGuide: A guide for the user to understand the software and how to use it.
- VnVPlan: A plan for Verification and Validation (testing) the project.
- VnVReport: A report on the Verification and Validation of the project which follows the VnVPlan.
- Makefile: A Makefile for the documentation of the project, which compiles the pdf for each of the aforementioned documents.
- *.tex: Common tex files used in each of the documents.
