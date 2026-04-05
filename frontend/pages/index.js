import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">Nexora</h1>
            </div>
            <div className="hidden md:flex space-x-8">
              <Link href="/product" className="text-gray-600 hover:text-primary">Product</Link>
              <Link href="/solutions" className="text-gray-600 hover:text-primary">Solutions</Link>
              <Link href="/stories" className="text-gray-600 hover:text-primary">Stories</Link>
              <Link href="/company" className="text-gray-600 hover:text-primary">Company</Link>
            </div>
            <div className="flex space-x-4">
              <Link href="/upload" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-6xl font-bold mb-6">The Platform for<br />Data Transformation Success</h1>
          <p className="text-xl mb-8 max-w-4xl mx-auto">
            Transform legacy code with AI-powered intelligence. Modernize your data pipelines,
            accelerate analytics delivery, and govern data transformations at enterprise scale.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/upload" className="bg-white text-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors">
              Start Free Trial
            </Link>
            <Link href="/demo" className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary transition-colors">
              Watch Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Data Transformation Success Formula */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-primary mb-16">The Data Transformation Success Formula</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">People</h3>
              <p className="text-gray-600 text-lg">Domain experts self-serve data transformation. Build and deploy faster with AI assistance.</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">Orchestration</h3>
              <p className="text-gray-600 text-lg">Connect data sources, transformations, and analytics. Design how your enterprise processes data.</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">Governance</h3>
              <p className="text-gray-600 text-lg">Track performance, cost, and compliance across all data transformations and pipelines.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Product Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-primary mb-16">Your Data Transformation Success Starts Here</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Feature 1 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-primary">Modernize Legacy Code</h3>
              </div>
              <p className="text-gray-600 text-lg mb-6">Convert legacy SQL, SAS, and other code to modern Python with AI-powered intelligence. Preserve business logic while modernizing infrastructure.</p>
              <Link href="/upload" className="text-primary font-semibold hover:underline">Explore code conversion →</Link>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-primary">Validate & Compare</h3>
              </div>
              <p className="text-gray-600 text-lg mb-6">Side-by-side comparison of original and converted code with detailed metrics, automated testing, and validation workflows.</p>
              <Link href="/compare" className="text-primary font-semibold hover:underline">Explore validation →</Link>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-primary">Interactive Notebooks</h3>
              </div>
              <p className="text-gray-600 text-lg mb-6">Create and collaborate on data transformation notebooks with integrated code execution, version control, and team sharing.</p>
              <Link href="/notebooks" className="text-primary font-semibold hover:underline">Explore notebooks →</Link>
            </div>

            {/* Feature 4 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-primary">Pipeline Orchestration</h3>
              </div>
              <p className="text-gray-600 text-lg mb-6">Build and manage complex data pipelines with visual DAG editor, automated scheduling, and enterprise-grade orchestration.</p>
              <Link href="/pipelines" className="text-primary font-semibold hover:underline">Explore pipelines →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Languages */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-primary mb-16">Supported Languages & Technologies</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">SQL</span>
              </div>
              <h3 className="font-semibold text-primary mb-2">SQL</h3>
              <p className="text-gray-600 text-sm">All major SQL dialects</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">SAS</span>
              </div>
              <h3 className="font-semibold text-primary mb-2">SAS</h3>
              <p className="text-gray-600 text-sm">SAS programs & macros</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <h3 className="font-semibold text-primary mb-2">R</h3>
              <p className="text-gray-600 text-sm">R scripts & packages</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">Python</span>
              </div>
              <h3 className="font-semibold text-primary mb-2">Python</h3>
              <p className="text-gray-600 text-sm">Legacy Python 2.x</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-red-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">Spark</span>
              </div>
              <h3 className="font-semibold text-primary mb-2">Spark</h3>
              <p className="text-gray-600 text-sm">PySpark & Scala</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">+</span>
              </div>
              <h3 className="font-semibold text-primary mb-2">More</h3>
              <p className="text-gray-600 text-sm">Custom languages</p>
            </div>
          </div>
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">Convert from legacy languages to modern Python, SQL, and Spark</p>
            <Link href="/upload" className="bg-primary text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors">
              Start Converting Code
            </Link>
          </div>
        </div>
      </section>

      {/* Product Types */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-primary mb-16">Transform Any Data Product Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-primary mb-2">ETL Pipelines</h3>
              <p className="text-gray-600">Extract, transform, and load data pipelines with complex business logic</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-primary mb-2">Analytics Scripts</h3>
              <p className="text-gray-600">Statistical analysis, reporting, and data science workflows</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-primary mb-2">Data Warehouses</h3>
              <p className="text-gray-600">Data warehouse procedures, views, and transformation logic</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-primary mb-2">Machine Learning</h3>
              <p className="text-gray-600">ML feature engineering, model training pipelines, and inference code</p>
            </div>
          </div>
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">From simple scripts to complex enterprise data products</p>
            <Link href="/upload" className="bg-primary text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors">
              Transform Your Data Products
            </Link>
          </div>
        </div>
      </section>

      {/* Customer Success Stories */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-primary mb-16">Leading Companies Deliver Data Success with Nexora</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                  <span className="text-white font-bold text-lg">J&J</span>
                </div>
                <h3 className="text-xl font-bold text-primary">Johnson & Johnson</h3>
              </div>
              <p className="text-gray-600 mb-4">Transforming vision care analytics with AI-powered data transformation, reducing time-to-insight by 60%.</p>
              <Link href="/stories/jnj" className="text-primary font-semibold hover:underline">Read the success story →</Link>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                  <span className="text-white font-bold text-lg">NOV</span>
                </div>
                <h3 className="text-xl font-bold text-primary">Novartis</h3>
              </div>
              <p className="text-gray-600 mb-4">Streamlining pharmaceutical analytics and AI across the organization with modernized data pipelines.</p>
              <Link href="/stories/novartis" className="text-primary font-semibold hover:underline">Read the success story →</Link>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center mr-4">
                  <span className="text-white font-bold text-lg">ROC</span>
                </div>
                <h3 className="text-xl font-bold text-primary">Roche</h3>
              </div>
              <p className="text-gray-600 mb-4">Transforming patent workflows with agentic AI and automated data transformation processes.</p>
              <Link href="/stories/roche" className="text-primary font-semibold hover:underline">Read the success story →</Link>
            </div>
          </div>
          <div className="text-center mt-12">
            <Link href="/stories" className="bg-primary text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors">
              See All Customer Stories
            </Link>
          </div>
        </div>
      </section>

      {/* Industry Solutions */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-primary mb-4">Industries Actively Using Nexora</h2>
          <p className="text-xl text-center text-gray-600 mb-16">Join 500+ enterprises across these industries transforming their data infrastructure</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
            <div className="text-center bg-gray-50 rounded-lg p-6">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="font-semibold text-primary mb-2">Financial Services</h3>
              <p className="text-sm text-gray-600 mb-2">Risk analytics, compliance reporting</p>
              <div className="text-xs text-green-600 font-semibold">150+ companies</div>
              <Link href="/solutions/financial" className="text-primary hover:underline text-sm">Learn more →</Link>
            </div>

            <div className="text-center bg-gray-50 rounded-lg p-6">
              <div className="w-16 h-16 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="font-semibold text-primary mb-2">Life Sciences</h3>
              <p className="text-sm text-gray-600 mb-2">Clinical trials, drug discovery</p>
              <div className="text-xs text-green-600 font-semibold">80+ companies</div>
              <Link href="/solutions/life-sciences" className="text-primary hover:underline text-sm">Learn more →</Link>
            </div>

            <div className="text-center bg-gray-50 rounded-lg p-6">
              <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="font-semibold text-primary mb-2">Manufacturing</h3>
              <p className="text-sm text-gray-600 mb-2">Supply chain, quality control</p>
              <div className="text-xs text-green-600 font-semibold">120+ companies</div>
              <Link href="/solutions/manufacturing" className="text-primary hover:underline text-sm">Learn more →</Link>
            </div>

            <div className="text-center bg-gray-50 rounded-lg p-6">
              <div className="w-16 h-16 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-primary mb-2">Retail & CPG</h3>
              <p className="text-sm text-gray-600 mb-2">Customer analytics, inventory</p>
              <div className="text-xs text-green-600 font-semibold">90+ companies</div>
              <Link href="/solutions/retail" className="text-primary hover:underline text-sm">Learn more →</Link>
            </div>

            <div className="text-center bg-gray-50 rounded-lg p-6">
              <div className="w-16 h-16 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-primary mb-2">Utilities & Energy</h3>
              <p className="text-sm text-gray-600 mb-2">Grid analytics, predictive maintenance</p>
              <div className="text-xs text-green-600 font-semibold">60+ companies</div>
              <Link href="/solutions/utilities" className="text-primary hover:underline text-sm">Learn more →</Link>
            </div>

            <div className="text-center bg-gray-50 rounded-lg p-6">
              <div className="w-16 h-16 bg-red-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="font-semibold text-primary mb-2">Public Sector</h3>
              <p className="text-sm text-gray-600 mb-2">Government data, citizen services</p>
              <div className="text-xs text-green-600 font-semibold">40+ agencies</div>
              <Link href="/solutions/public-sector" className="text-primary hover:underline text-sm">Learn more →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Recognition & Trust */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-8">Trusted by Enterprise Teams Worldwide</h2>
            <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-center mb-4">
                <div className="flex text-yellow-400">
                  {'★'.repeat(5)}
                </div>
                <span className="ml-2 text-gray-600">4.8/5 (2,341 reviews)</span>
              </div>
              <p className="text-gray-600 italic">"Nexora transformed our legacy data infrastructure, reducing transformation time by 70% while ensuring complete governance and compliance."</p>
              <p className="text-primary font-semibold mt-4">Chief Data Officer, Fortune 500 Company</p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">500+</div>
              <p className="text-gray-600">Enterprise Customers</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">10M+</div>
              <p className="text-gray-600">Lines of Code Transformed</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
              <p className="text-gray-600">Uptime SLA</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready for Data Transformation Success?</h2>
          <p className="text-xl mb-8">Join leading enterprises who trust Nexora to modernize their data infrastructure.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/upload" className="bg-white text-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors">
              Start Free Trial
            </Link>
            <Link href="/demo" className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary transition-colors">
              Request Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">Nexora</h3>
              <p className="text-gray-400">The Platform for Data Transformation Success</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/upload" className="hover:text-white">Upload & Convert</Link></li>
                <li><Link href="/compare" className="hover:text-white">Compare & Validate</Link></li>
                <li><Link href="/notebooks" className="hover:text-white">Notebooks</Link></li>
                <li><Link href="/pipelines" className="hover:text-white">Pipelines</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Solutions</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/solutions/financial" className="hover:text-white">Financial Services</Link></li>
                <li><Link href="/solutions/life-sciences" className="hover:text-white">Life Sciences</Link></li>
                <li><Link href="/solutions/manufacturing" className="hover:text-white">Manufacturing</Link></li>
                <li><Link href="/solutions/retail" className="hover:text-white">Retail & CPG</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/stories" className="hover:text-white">Customer Stories</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2026 Nexora. All rights reserved. | <Link href="/privacy" className="hover:text-white">Privacy Policy</Link> | <Link href="/terms" className="hover:text-white">Terms of Service</Link></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
